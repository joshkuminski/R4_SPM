-- NULL values are data points that may have a missing End Of Green (EC=8)
--EC = 1 Phase Begin Green
--EC = 8 Phase Begin Yellow
--EC = 9 Phase End Yellow
--EC = 11 Phase End Red
-- Variables to pass:
-- @Buffer = Xs buffer - actuations during green interval
-- @StartTime, @ EndTime, @SelectedDate, @Phase, @Detector_Config_Table, @HiRes_Table


-- Yellow and Red Actuations - all detector actuations after the green interval
-- See SSMS file: 531-36_Red_Yellow_Actuations.sql for example
WITH VIEW1 AS (
    SELECT
        *,
        CASE
            WHEN EC = 8 AND Param = @Phase THEN time
            ELSE NULL
        END AS EndOfGreen
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
