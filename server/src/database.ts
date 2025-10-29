import { Pool, QueryResult as PgQueryResult } from 'pg';

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || '';
const MAX_ROWS = 1000;
const ALLOWED_STATEMENTS = ['SELECT'];

// Create connection pool
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    // Convert postgres:// to postgresql:// if needed
    const dbUrl = DATABASE_URL.startsWith('postgres://') 
      ? DATABASE_URL.replace('postgres://', 'postgresql://')
      : DATABASE_URL;
    
    pool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Query validation
function validateQuery(query: string): { valid: boolean; error?: string } {
  const trimmed = query.trim().toUpperCase();
  
  if (!trimmed) {
    return { valid: false, error: 'Empty or invalid query' };
  }
  
  if (!trimmed.startsWith('SELECT')) {
    return { valid: false, error: 'Only SELECT statements allowed' };
  }
  
  const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
  for (const keyword of dangerous) {
    if (trimmed.includes(keyword)) {
      return { valid: false, error: `Dangerous keyword: ${keyword}` };
    }
  }
  
  return { valid: true };
}

// Execute query with safety checks
export async function executeQuery(query: string, limit?: number, params?: any[]): Promise<{
  success: boolean;
  rows?: any[];
  columns?: string[];
  row_count?: number;
  error?: string;
}> {
  const validation = validateQuery(query);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const actualLimit = limit ? Math.min(limit, MAX_ROWS) : MAX_ROWS;
  
  // Add LIMIT if not present
  let finalQuery = query.trim();
  if (!finalQuery.toUpperCase().includes('LIMIT')) {
    finalQuery = `${finalQuery.replace(/;$/, '')} LIMIT ${actualLimit}`;
  }
  
  try {
    const client = getPool();
    const result: PgQueryResult = await client.query(finalQuery, params);
    
    const columns = result.fields.map(f => f.name);
    const rows = result.rows;
    
    return {
      success: true,
      rows,
      columns,
      row_count: rows.length
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Execute SQL query tool
export async function executeSqlQuery(query: string): Promise<string> {
  const result = await executeQuery(query);
  
  if (result.success) {
    return JSON.stringify({
      row_count: result.row_count,
      columns: result.columns,
      data: result.rows
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Get database schema tool
export async function getDatabaseSchema(): Promise<string> {
  const query = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'digital_insights'
    ORDER BY ordinal_position;
  `;
  
  const result = await executeQuery(query);
  
  if (result.success) {
    return JSON.stringify({
      table: 'digital_insights',
      total_columns: result.row_count,
      columns: result.rows
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Get sample data tool
export async function getSampleData(limit: number = 10): Promise<string> {
  const actualLimit = Math.min(limit, 100);
  const result = await executeQuery(`SELECT * FROM digital_insights LIMIT ${actualLimit}`);
  
  if (result.success) {
    return JSON.stringify({
      sample_size: result.row_count,
      columns: result.columns,
      data: result.rows
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Get database statistics tool
export async function getDatabaseStatistics(): Promise<string> {
  // Get total count
  const countResult = await executeQuery("SELECT COUNT(*) as total FROM digital_insights");
  
  // Get platform distribution
  const platformQuery = `
    SELECT 
      type as platform,
      COUNT(*) as count,
      ROUND(AVG(duration_sum)::numeric, 2) as avg_duration_seconds,
      ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 2) as percentage
    FROM digital_insights
    GROUP BY type
    ORDER BY count DESC
  `;
  const platformResult = await executeQuery(platformQuery);
  
  if (countResult.success && platformResult.success) {
    return JSON.stringify({
      total_rows: countResult.rows![0].total,
      platforms: platformResult.rows
    }, null, 2);
  } else {
    const error = countResult.error || platformResult.error;
    return `Error: ${error}`;
  }
}

// Get column value counts tool
export async function getColumnValueCounts(columnName: string, limit: number = 20): Promise<string> {
  // Validate column name
  const validColumns = [
    'type', 'cat', 'genre', 'age_bucket', 'gender', 'nccs_class',
    'state_grp', 'day_of_week', 'population', 'app_name'
  ];
  
  if (!validColumns.includes(columnName)) {
    return `Error: Invalid column name. Valid columns are: ${validColumns.join(', ')}`;
  }
  
  const actualLimit = Math.min(limit, 100);
  const query = `
    SELECT 
      ${columnName} as value,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 2) as percentage
    FROM digital_insights
    WHERE ${columnName} IS NOT NULL
    GROUP BY ${columnName}
    ORDER BY count DESC
    LIMIT ${actualLimit}
  `;
  
  const result = await executeQuery(query);
  
  if (result.success) {
    return JSON.stringify({
      column: columnName,
      unique_values: result.row_count,
      distribution: result.rows
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Close pool on shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

