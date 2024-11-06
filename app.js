const express = require('express');
const Redis = require('ioredis');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const redis = new Redis(); // Connect to Redis
const app = express();
app.use(express.json());

// Basic rate limiting
const limiter = rateLimit({
    keyGenerator: (req) => req.body.user_id,
    windowMs: 60000, // 1 minute
    max: 20, // Limit each user to 20 requests per minute
    handler: async (req, res) => {
        await addToQueue(req.body.user_id); // Queue task if limit is reached
        res.status(429).send("Too many requests - queued your task.");
    },
    skipSuccessfulRequests: true,
});

// Route to handle the task
app.post('/task', limiter, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).send("User ID required");

    await addToQueue(user_id); // Add task to queue
    res.status(202).send("Task received and queued.");
});

// Function to add a task to the Redis queue
async function addToQueue(user_id) {
    const timestamp = Date.now();
    await redis.lpush(`task_queue:${user_id}`, timestamp);
    processQueue(user_id); // Process the queue
}

// Process the task queue with a 1 task/sec limit
async function processQueue(user_id) {
    const queueKey = `task_queue:${user_id}`;

    // Only one worker can process this user’s queue at a time
    const lock = await redis.set(`lock:${queueKey}`, 'locked', 'NX', 'EX', 1);
    if (!lock) return; // If already processing, exit

    let taskTimestamp;
    while ((taskTimestamp = await redis.rpop(queueKey))) {
        await processTask(user_id, taskTimestamp); // Process each task
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit: 1 task per second
    }
    await redis.del(`lock:${queueKey}`); // Release lock
}

// Simulate the task and log to a file
async function processTask(user_id, timestamp) {
    console.log(`${user_id} - task completed at ${new Date(timestamp).toISOString()}`);
    fs.appendFileSync('task_log.txt', `${user_id} - task completed at ${new Date(timestamp).toISOString()}\n`);
}

module.exports = app;
