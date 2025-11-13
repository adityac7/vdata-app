import { Pool, QueryResult as PgQueryResult } from 'pg';

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || '';
const HUL_DATABASE_URL = process.env.HUL_DATABASE_URL || '';
const MAX_ROWS = 1000;
const ALLOWED_STATEMENTS = ['SELECT'];

// Database types
export type DatabaseType = 'main' | 'hul';

// Connection pool manager
const pools: Map<DatabaseType, Pool> = new Map();

function getPool(dbType: DatabaseType = 'main'): Pool {
  if (!pools.has(dbType)) {
    const dbUrl = dbType === 'hul' ? HUL_DATABASE_URL : DATABASE_URL;

    if (!dbUrl) {
      throw new Error(`Database URL not configured for: ${dbType}`);
    }

    // Convert postgres:// to postgresql:// if needed
    const normalizedUrl = dbUrl.startsWith('postgres://')
      ? dbUrl.replace('postgres://', 'postgresql://')
      : dbUrl;

    const pool = new Pool({
      connectionString: normalizedUrl,
      ssl: normalizedUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    pools.set(dbType, pool);
  }

  return pools.get(dbType)!;
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
export async function executeQuery(
  query: string,
  limit?: number,
  params?: any[],
  dbType: DatabaseType = 'main'
): Promise<{
  success: boolean;
  rows?: any[];
  columns?: string[];
  row_count?: number;
  error?: string;
  database?: DatabaseType;
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
    const client = getPool(dbType);
    const result: PgQueryResult = await client.query(finalQuery, params);

    const columns = result.fields.map(f => f.name);
    const rows = result.rows;

    return {
      success: true,
      rows,
      columns,
      row_count: rows.length,
      database: dbType
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
export async function getSampleData(limit: number = 10, tableName: string = 'digital_insights', dbType: DatabaseType = 'main'): Promise<string> {
  const actualLimit = Math.min(limit, 100);
  const result = await executeQuery(`SELECT * FROM ${tableName} LIMIT ${actualLimit}`, undefined, undefined, dbType);

  if (result.success) {
    return JSON.stringify({
      sample_size: result.row_count,
      columns: result.columns,
      data: result.rows,
      database: result.database
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Get database statistics tool
export async function getDatabaseStatistics(tableName: string = 'digital_insights', dbType: DatabaseType = 'main'): Promise<string> {
  // Get total count
  const countResult = await executeQuery(`SELECT COUNT(*) as total FROM ${tableName}`, undefined, undefined, dbType);

  // Get platform distribution (only for digital_insights table)
  if (tableName === 'digital_insights') {
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
    const platformResult = await executeQuery(platformQuery, undefined, undefined, dbType);

    if (countResult.success && platformResult.success) {
      return JSON.stringify({
        total_rows: countResult.rows![0].total,
        platforms: platformResult.rows,
        database: dbType
      }, null, 2);
    } else {
      const error = countResult.error || platformResult.error;
      return `Error: ${error}`;
    }
  } else {
    // Generic statistics for other tables
    if (countResult.success) {
      return JSON.stringify({
        total_rows: countResult.rows![0].total,
        database: dbType,
        table: tableName
      }, null, 2);
    } else {
      return `Error: ${countResult.error}`;
    }
  }
}

// Get column value counts tool
export async function getColumnValueCounts(columnName: string, limit: number = 20, tableName: string = 'digital_insights', dbType: DatabaseType = 'main'): Promise<string> {
  const actualLimit = Math.min(limit, 100);
  const query = `
    SELECT
      ${columnName} as value,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 2) as percentage
    FROM ${tableName}
    WHERE ${columnName} IS NOT NULL
    GROUP BY ${columnName}
    ORDER BY count DESC
    LIMIT ${actualLimit}
  `;

  const result = await executeQuery(query, undefined, undefined, dbType);

  if (result.success) {
    return JSON.stringify({
      column: columnName,
      unique_values: result.row_count,
      distribution: result.rows,
      database: dbType,
      table: tableName
    }, null, 2);
  } else {
    return `Error: ${result.error}`;
  }
}

// Close all pools on shutdown
export async function closePool(): Promise<void> {
  for (const [dbType, pool] of pools.entries()) {
    await pool.end();
  }
  pools.clear();
}

