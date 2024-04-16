import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';
import { popbillScraping } from './scrap-popbill.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        let return_moment = returnMoment();
        pushDepositNoti();

        if (parseInt(return_moment.split(' ')[1].split(':')[1]) % 5 == 0) {
            popbillScraping();
        }

        pushAsapMall(return_moment);
    })
}
export default scheduleIndex;