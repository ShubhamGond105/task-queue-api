const cluster = require('cluster');
const http = require('http');
const os = require('os');
const app = require('./app');

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < 2; i++) { 
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork(); 
    });
} else {
    http.createServer(app).listen(3000, () => {
        console.log(`Worker ${process.pid} started`);
    });
}
