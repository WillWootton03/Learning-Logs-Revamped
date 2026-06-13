// Declares key patterns for data access
const keys = {
    user: (userId) => `USER#${userId}`,
    board: (boardId) => `BOARD#${boardId}`,
    
    log: (createdAt,logId) => `LOG#${logId}`,
    concept: (conceptId) => `CONCEPT#${conceptId}`,
    studySession: (createdAt, studySessionId) => `STUDYSESSION#${studySessionId}`,
    tag: (tagId) => `TAG#${tagId}`, 
};

module.exports = {
    keys
};