import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';
import { popbillScraping } from './scrap-popbill.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        if (process.env.INSTANCE_ID != '0') {
            return;
        }
        let return_moment = returnMoment();

        pushDepositNoti();

        popbillScraping();

        pushAsapMall(return_moment);
    })
}

export default scheduleIndex;