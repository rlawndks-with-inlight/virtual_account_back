import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';
import { popbillScraping } from './scrap-popbill.js';
import { destructAutoVirtualAcct } from './destruct-auto-virtual-acct.js';
import { onParentBrandSettle } from './parent-brand-settle.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        //let pm2_back_id = await pool.query(`SELECT * FROM `)
        let return_moment = returnMoment();

        if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 1) {
            destructAutoVirtualAcct();
            pushDepositNoti();
            onParentBrandSettle(return_moment);
        }
        if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 2) {
            popbillScraping();
            pushAsapMall(return_moment);
        }
    })
}

export default scheduleIndex;