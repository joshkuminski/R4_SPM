SELECT * 
FROM @split_table 
WHERE CONVERT(DATE, Timestamp) = '@SelectedDate'
ORDER BY Timestamp