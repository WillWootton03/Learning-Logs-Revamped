// Declares key patterns for data
const keys = {
    user: (userId) => `USER#${userId}`,
    board: (boardId) => `BOARD#${boardId}`,
    log: (boardId, logId) => `BOARD#${boardId}#LOG#${logId}`,
    concept: (boardId, conceptId) => `BOARD#${boardId}#CONCEPT#${conceptId}`,
    studySession: (boardId, studySessionId) => `BOARD#${boardId}#STUDYSESSION#${studySessionId}`
};

module.exports = {
    keys
};