import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        pushDepositNoti();
        pushAsapMall();
    })
}
export default scheduleIndex;