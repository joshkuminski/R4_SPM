SELECT
    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, timestamp) / 15 * 15, 0) AS interval_start,

    -- Movements totals
    SUM(CASE WHEN movement = 'NBL' THEN qty ELSE 0 END) AS total_NBL,
    SUM(CASE WHEN movement = 'NBT' THEN qty ELSE 0 END) AS total_NBT,
    SUM(CASE WHEN movement = 'NBR' THEN qty ELSE 0 END) AS total_NBR,
    SUM(CASE WHEN movement = 'SBL' THEN qty ELSE 0 END) AS total_SBL,
    SUM(CASE WHEN movement = 'SBT' THEN qty ELSE 0 END) AS total_SBT,
    SUM(CASE WHEN movement = 'SBR' THEN qty ELSE 0 END) AS total_SBR,
    SUM(CASE WHEN movement = 'EBL' THEN qty ELSE 0 END) AS total_EBL,
    SUM(CASE WHEN movement = 'EBT' THEN qty ELSE 0 END) AS total_EBT,
    SUM(CASE WHEN movement = 'EBR' THEN qty ELSE 0 END) AS total_EBR,
    SUM(CASE WHEN movement = 'WBL' THEN qty ELSE 0 END) AS total_WBL,
    SUM(CASE WHEN movement = 'WBT' THEN qty ELSE 0 END) AS total_WBT,
    SUM(CASE WHEN movement = 'WBR' THEN qty ELSE 0 END) AS total_WBR,
    SUM(qty) AS total_volume,

    -- Class-specific totals
    SUM(CASE WHEN class = 'ArticulatedTruck' THEN qty ELSE 0 END) AS total_articulated_truck,
    SUM(CASE WHEN class = 'SingleUnitTruck' THEN qty ELSE 0 END) AS total_single_unit_truck,
    SUM(CASE WHEN class = 'Bus' THEN qty ELSE 0 END) AS total_bus,
    SUM(CASE WHEN class = 'Bicycle' THEN qty ELSE 0 END) AS total_bicycle,
    SUM(CASE WHEN class = 'Light' THEN qty ELSE 0 END) AS total_light
FROM
    @intersection
WHERE
    timestamp >= '@start_date' AND timestamp <= '@end_date'
GROUP BY
    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, timestamp) / 15 * 15, 0)
ORDER BY
    interval_start;
