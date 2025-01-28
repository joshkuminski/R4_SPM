CREATE TABLE IntersectionNotes (
    NoteId INT IDENTITY PRIMARY KEY,
    IntersectionId NVARCHAR(MAX) NOT NULL,
    Content NVARCHAR(MAX), -- Store rich text as HTML
    Timestamp DATETIME DEFAULT GETDATE()
);
