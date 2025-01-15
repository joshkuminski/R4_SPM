-- TODO this is just a copy from Yellow_Red_Actuations - needs to be converted to get the Green

-- NULL values are data points that may have a missing End Of Green (EC=8)
--EC = 1 Phase Begin Green
--EC = 8 Phase Begin Yellow
--EC = 9 Phase End Yellow
--EC = 11 Phase End Red
-- Variables to pass:
-- @Buffer = Xs buffer - actuations during green interval
-- @StartTime, @ EndTime, @SelectedDate, @Phase, @Detector_Config_Table, @HiRes_Table


-- Green Actuations - all detector actuations during the green interval
-- See SSMS file: 531-36_Red_Yellow_Actuations.sql for example
WITH VIEW1 AS (
    SELECT
        *,
        CASE
            WHEN EC = 1 AND Param = @Phase THEN time
            ELSE NULL
        END AS BeginOfGreen
    FROM @HiRes_Table
),
VIEW2 AS (
    SELECT
        *,
        MAX(EndOfGreen) OVER (ORDER BY time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Filled_EndOfGreen
    FROM VIEW1
),
VIEW3 AS (
    SELECT
        *,
        CASE
            --CHECK THAT THE PREVIOUS TIME IS NOT AN OUTLIER
            WHEN DATEDIFF(SECOND, Filled_EndOfGreen, time) <= @Buffer THEN
                CAST(DATEDIFF(MILLISECOND, Filled_EndOfGreen, time) AS INTEGER)
                --THIS FUNCTION CALCULATES THE TIME DIFFERENCE BETWEEN THE PREVIOUS TIME WITH EC=8
                --AND THE CURRENT TIME FOR EACH ROW WHERE EC=82
            ELSE
                NULL
        END AS Clearance_Actuations
    FROM VIEW2
)
SELECT * --date, time, Clearance_Actuations
FROM VIEW3
	JOIN
		--JOIN THE HIRES TABLE WITH THE DETECTOR TABLE. ROWS FROM HIRES WHERE PARAM = DETECTOR FROM DETECTOR
		-- TABLE.
		@Detector_Config_Table as config ON VIEW3.Param = config.Detector
	WHERE
		VIEW3.EC IN (82, 8)--Just the detector 'ON' enums.
		AND VIEW3.date = @SelectedDate
        AND config.[Function] = 'count' -- just the count zones
        AND config.Detector IN (52, 53) --Filter out the Right Turn Detectors
		---AND CAST(VIEW3.time as TIME) BETWEEN @StartTime AND @EndTime --If we want to filter by TOD
		AND config.Param = @Phase
ORDER BY time DESC;








DECLARE @Phase INTEGER; 
SET @Phase = 2;
DECLARE @buffer INTEGER;
SET @buffer = 15;  -- 15s buffer
DECLARE @SelectedDate DATE;
SET @SelectedDate = '2024-05-09';
DECLARE @StartTime TIME;
SET @StartTime = '04:00:00.00';
DECLARE @EndTime TIME;
SET @EndTime = '23:00:00.00';

-- Green Interval Actuations
WITH VIEW1 AS (
    SELECT 
        *,
        CASE
            WHEN EC = 8 AND Param = @Phase THEN TimeStamp  -- EC=8 marks the end of green
            ELSE NULL
        END AS EndOfGreen,
        CASE
            WHEN EC = 1 AND Param = @Phase THEN TimeStamp  -- EC=1 marks the start of green
            ELSE NULL
        END AS StartOfGreen
    FROM [531@36_redExtend].dbo.HiResData_before
),
VIEW2 AS (
    SELECT 
        *,
        MAX(EndOfGreen) OVER (ORDER BY TimeStamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Filled_EndOfGreen,
        MAX(StartOfGreen) OVER (ORDER BY TimeStamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Filled_StartOfGreen
    FROM VIEW1
),
VIEW3 AS (
    SELECT 
        *,
        CASE 
            -- CHECK THAT THE CURRENT TIME FALLS IN THE GREEN INTERVAL
            WHEN DATEDIFF(SECOND, Filled_StartOfGreen, TimeStamp) >= 0 
                 AND DATEDIFF(SECOND, TimeStamp, Filled_EndOfGreen) >= 0 THEN
                CAST(DATEDIFF(MILLISECOND, Filled_StartOfGreen, TimeStamp) AS INTEGER)
                -- Calculate the time difference between the green start and the current timestamp
            ELSE 
                NULL
        END AS Green_Actuations
    FROM VIEW2
)
SELECT * --TimeStamp, Green_Actuations
FROM VIEW3
    JOIN 
        [531@36_redExtend].dbo.Config_0422 AS config ON VIEW3.Param = config.Detector
WHERE 
    VIEW3.EC IN (82, 1)  -- Detector ON enums during green (EC=1 for green start)
    AND config.Phase = @Phase  -- Just the actuations for the selected phase
    -- AND config.[Function] = 'PostSB' -- Uncomment if filtering by specific functions
    -- AND config.Detector IN (52, 53) -- Uncomment if filtering by specific detectors
    -- AND VIEW3.date = @SelectedDate
    -- AND CAST(VIEW3.time AS TIME) BETWEEN @StartTime AND @EndTime
ORDER BY TimeStamp DESC;
