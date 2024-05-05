import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';
import { popbillScraping } from './scrap-popbill.js';
import { destructAutoVirtualAcct } from './destruct-auto-virtual-acct.js';
import { getVirAcctByLouis } from './get-virtual-acct-louis.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {
        //let pm2_back_id = await pool.query(`SELECT * FROM `)
        if (parseInt(process.env.INSTANCE_ID) != parseInt(process.env.instances) - 1) {
            return;
        }
        let return_moment = returnMoment();
        destructAutoVirtualAcct();
        pushDepositNoti();
        // popbillScraping();
        pushAsapMall(return_moment);

    })
}

export default scheduleIndex;