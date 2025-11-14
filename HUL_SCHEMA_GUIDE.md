# HUL Database Schema Guide

## Database Connection
- **Database**: `hul`
- **Table**: `hul_combined_data`
- **Total Rows**: 629,890

## Complete Column Schema

Based on the actual database structure, here are all columns with their data types:

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | bigint | Primary key |
| vtionid | text | User/visitor ID |
| app | text | **ARRAY COLUMN** - E-commerce app name (Amazon, Flipkart, etc.) |
| brand | text | Brand name |
| event_ad | integer | Count of ad view events |
| event_search | integer | Count of search events |
| event_product | integer | Count of product view events |
| event_cart | integer | Count of add-to-cart events |
| cat | text | Product category |
| parent_company | text | Parent company name |
| Seen Ad | text | **ARRAY COLUMN** - List of ads seen |
| Searched Product | text | **ARRAY COLUMN** - List of products searched |
| Seen Product | text | **ARRAY COLUMN** - List of products viewed |
| Added to Cart | text | **ARRAY COLUMN** - List of products added to cart |
| Category Interaction | text | **ARRAY COLUMN** - List of category interactions |
| Month | text | Month of activity |
| Year | integer | Year of activity |
| nccs_code | text | NCCS (socioeconomic) classification |
| age | text | Age group |
| gender | text | Gender |
| State | text | Indian state |
| Population | text | Population segment |
| zone | text | Geographic zone |
| *Additional columns may exist* | | |

## PostgreSQL Array Query Instructions

### Understanding Array Columns

Several columns in the `hul_combined_data` table store **PostgreSQL text arrays** (stored as text with array-like formatting). These include:
- `app`
- `"Seen Ad"`
- `"Searched Product"`
- `"Seen Product"`
- `"Added to Cart"`
- `"Category Interaction"`

### Array Query Patterns

#### 1. **Unnesting Arrays** (Most Common)
To expand array elements into separate rows:

```sql
-- Unnest the app column
SELECT 
    vtionid,
    brand,
    UNNEST(string_to_array(app, ',')) AS app_name
FROM hul_combined_data
WHERE app IS NOT NULL AND app != ''
LIMIT 100;
```

#### 2. **Checking Array Membership**
To find rows where an array contains a specific value:

```sql
-- Find users who saw ads for a specific brand
SELECT 
    vtionid,
    brand,
    "Seen Ad"
FROM hul_combined_data
WHERE "Seen Ad" LIKE '%Amazon%'
LIMIT 100;
```

#### 3. **Array Length**
To count elements in an array:

```sql
-- Count number of products seen per user
SELECT 
    vtionid,
    brand,
    array_length(string_to_array("Seen Product", ','), 1) AS products_seen_count
FROM hul_combined_data
WHERE "Seen Product" IS NOT NULL AND "Seen Product" != ''
LIMIT 100;
```

#### 4. **Aggregating Array Data**
To aggregate across unnested arrays:

```sql
-- Count occurrences of each app
SELECT 
    TRIM(UNNEST(string_to_array(app, ','))) AS app_name,
    COUNT(*) AS occurrence_count
FROM hul_combined_data
WHERE app IS NOT NULL AND app != ''
GROUP BY app_name
ORDER BY occurrence_count DESC
LIMIT 20;
```

#### 5. **Multiple Array Joins**
To correlate data across multiple array columns:

```sql
-- Find users who both searched and added products to cart
SELECT 
    vtionid,
    brand,
    "Searched Product",
    "Added to Cart"
FROM hul_combined_data
WHERE 
    "Searched Product" IS NOT NULL AND "Searched Product" != ''
    AND "Added to Cart" IS NOT NULL AND "Added to Cart" != ''
LIMIT 100;
```

#### 6. **Array Intersection**
To find common elements between arrays:

```sql
-- Find products that were both seen and added to cart
SELECT 
    vtionid,
    brand,
    ARRAY(
        SELECT UNNEST(string_to_array("Seen Product", ','))
        INTERSECT
        SELECT UNNEST(string_to_array("Added to Cart", ','))
    ) AS products_seen_and_carted
FROM hul_combined_data
WHERE 
    "Seen Product" IS NOT NULL AND "Seen Product" != ''
    AND "Added to Cart" IS NOT NULL AND "Added to Cart" != ''
LIMIT 100;
```

### Important Notes

1. **Column Name Quoting**: Columns with spaces (like `"Seen Ad"`) MUST be quoted with double quotes in SQL queries.

2. **Array Delimiter**: Arrays are stored as comma-separated text. Use `string_to_array(column, ',')` to convert to PostgreSQL arrays.

3. **NULL Handling**: Always check for NULL and empty strings when working with array columns:
   ```sql
   WHERE column IS NOT NULL AND column != ''
   ```

4. **Performance**: Unnesting large arrays can be slow. Use LIMIT and WHERE clauses to restrict result sets.

5. **Trimming**: Array elements may have leading/trailing spaces. Use `TRIM()` when unnesting:
   ```sql
   TRIM(UNNEST(string_to_array(column, ',')))
   ```

### Example: Complete Analysis Query

```sql
-- Comprehensive user journey analysis
SELECT 
    vtionid,
    brand,
    cat,
    nccs_code,
    age,
    gender,
    State,
    event_ad,
    event_search,
    event_product,
    event_cart,
    array_length(string_to_array("Seen Ad", ','), 1) AS ads_seen_count,
    array_length(string_to_array("Searched Product", ','), 1) AS searches_count,
    array_length(string_to_array("Seen Product", ','), 1) AS products_viewed_count,
    array_length(string_to_array("Added to Cart", ','), 1) AS cart_additions_count
FROM hul_combined_data
WHERE 
    event_ad > 0 
    OR event_search > 0 
    OR event_product > 0 
    OR event_cart > 0
LIMIT 100;
```

## Query Best Practices

1. **Always specify database parameter**: Use `database: 'hul'` when calling query tools
2. **Use correct table name**: `hul_combined_data` (not `hul_data`)
3. **Quote column names with spaces**: Use double quotes for columns like `"Seen Ad"`
4. **Filter early**: Apply WHERE clauses before unnesting to improve performance
5. **Limit results**: Always use LIMIT for exploratory queries
6. **Handle NULLs**: Check for NULL and empty strings in array columns

## Common Query Patterns

### User Behavior Analysis
```sql
SELECT 
    gender,
    age,
    COUNT(*) AS user_count,
    AVG(event_ad) AS avg_ads_seen,
    AVG(event_search) AS avg_searches,
    AVG(event_cart) AS avg_cart_additions
FROM hul_combined_data
GROUP BY gender, age
ORDER BY user_count DESC;
```

### Brand Performance
```sql
SELECT 
    brand,
    COUNT(*) AS interactions,
    SUM(event_ad) AS total_ad_views,
    SUM(event_search) AS total_searches,
    SUM(event_product) AS total_product_views,
    SUM(event_cart) AS total_cart_additions
FROM hul_combined_data
GROUP BY brand
ORDER BY interactions DESC
LIMIT 20;
```

### Geographic Distribution
```sql
SELECT 
    State,
    zone,
    COUNT(*) AS user_count,
    COUNT(DISTINCT vtionid) AS unique_users
FROM hul_combined_data
GROUP BY State, zone
ORDER BY user_count DESC;
```
