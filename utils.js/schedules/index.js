import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        let return_moment = returnMoment();
        pushDepositNoti();
        pushAsapMall(return_moment);
    })
}
export default scheduleIndex;