SELECT
    CONVERT(DATE, timestamp) AS day,
    SUM(qty) AS daily_volume
FROM
    @intersection
GROUP BY
    CONVERT(DATE, timestamp)
ORDER BY
    day;
