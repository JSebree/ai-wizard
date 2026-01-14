import { Queue, Worker } from 'bullmq';
import { CONFIG } from './config';
import IORedis from 'ioredis';

const connection = new IORedis(CONFIG.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export const videoQueue = new Queue('video-generation', { connection });

import { processVideoJob } from './director';

export const setupWorker = () => {
    const worker = new Worker('video-generation', async job => {
        console.log(`Processing job ${job.id}:`, job.data);
        try {
            const result = await processVideoJob(job);
            return result;
        } catch (err: any) {
            console.error(`Job ${job.id} failed inside worker:`, err);
            throw err;
        }
    }, { connection, concurrency: 50 });

    worker.on('completed', job => {
        console.log(`Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed: ${err.message}`);
    });

    console.log('Worker started for queue: video-generation');
};
