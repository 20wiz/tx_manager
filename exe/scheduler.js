const { getFarmAssets } = require('../util/my_lp_multi');

// const INTERVAL =  60 * 60 * 1000; // 1 h in milliseconds
const INTERVAL =  10 * 60 * 1000; // 10m in milliseconds
console.log('Scheduler started with interval:', INTERVAL);

setInterval(async () => {
    try {
        await getFarmAssets();
    } catch (error) {
        console.error('Error in updateUserRewards:', error);
    }
}, INTERVAL);

