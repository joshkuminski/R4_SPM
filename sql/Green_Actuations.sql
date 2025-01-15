-- NULL values are data points that may have a missing End Of Green (EC=8)
--EC = 1 Phase Begin Green
--EC = 8 Phase Begin Yellow
--EC = 9 Phase End Yellow
--EC = 11 Phase End Red
-- Variables to pass:
-- @StartTime, @ EndTime, @SelectedDate, @Phase, @Detector_Config_Table, @HiRes_Table

DECLARE @buffer INTEGER;
SET @buffer = 5;  -- ** Grab actuations 5s into the yellow/red **


-- Green Interval Actuations
WITH VIEW1 AS (
    SELECT
        *,
        CASE
            WHEN eventCode = 8 AND eventParam = @Phase THEN hires.timestamp  -- EC=8 marks the end of green
            ELSE NULL
        END AS EndOfGreen,
        CASE
            WHEN eventCode = 1 AND eventParam = @Phase THEN hires.timestamp  -- EC=1 marks the start of green
            ELSE NULL
        END AS StartOfGreen
    FROM @HiRes_Table as hires --NY252 @ Marketplace
),
VIEW2 AS (
    SELECT
        *,
        MAX(EndOfGreen) OVER (ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Filled_EndOfGreen,
        MAX(StartOfGreen) OVER (ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Filled_StartOfGreen
    FROM VIEW1
),
VIEW3 AS (
    SELECT
        *,
        CASE
            -- CHECK THAT THE CURRENT TIME FALLS IN THE GREEN INTERVAL + 5s (buffer)
            WHEN DATEDIFF(SECOND, Filled_StartOfGreen, timestamp) >= 0
                 AND DATEDIFF(SECOND, (Filled_EndOfGreen - @buffer), Filled_StartOfGreen) >= 0 THEN
                CAST(DATEDIFF(MILLISECOND, Filled_StartOfGreen, timestamp) AS INTEGER)
                -- Calculate the time difference between the green start and the current timestamp
            ELSE
                NULL
        END AS Green_Actuations
    FROM VIEW2
)
SELECT * --timestamp, eventParam, Green_Actuations, SetbackDist, Label
FROM VIEW3
    JOIN
        @Detector_Config_Table AS config ON VIEW3.eventParam = config.Detector
WHERE
    VIEW3.eventCode IN (82)  -- Detector ON enums during green add 81 for occupancy
    AND config.Phase = @Phase  -- Just the actuations for the selected phase
    --AND config.[Function] = 'point' -- Uncomment if filtering by specific functions
    AND CONVERT(DATE, timestamp) = @SelectedDate  --Get just the date from the timestamp
ORDER BY timestamp;