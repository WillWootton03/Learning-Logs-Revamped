const { QueryCommand, PutCommand, GetCommand} = require('@aws-sdk/client-dynamodb');
const { db } =  require("../db/db.js");
const { keys } =  require("../db/keys.js");