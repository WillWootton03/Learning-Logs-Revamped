// Declares key patterns for data access
const keys = {
    user: (userId) => `USER#${userId}`,
    board: (boardId) => `BOARD#${boardId}`,
    
    log: (logId) => `LOG#${logId}`,
    concept: (conceptId) => `CONCEPT#${conceptId}`,
    session: (sessionId) => `SESSION#${sessionId}`,
    tag: (tagId) => `TAG#${tagId}`, 
};

module.exports = {
    keys
};