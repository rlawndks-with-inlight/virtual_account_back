import schedule from 'node-schedule';
import { pushDepositNoti } from './push-noti.js';
import { pushAsapMall } from './push-asapmall.js';
import { returnMoment } from '../function.js';
import { popbillScraping } from './scrap-popbill.js';
import { destructAutoVirtualAcct } from './destruct-auto-virtual-acct.js';
import { onParentBrandSettle } from './parent-brand-settle.js';
import { blockHackIp } from './block-hack-ip.js';
import { payConfirmProcess } from './pay-confirm-process.js';

const scheduleIndex = () => {
    schedule.scheduleJob('0 0/1 * * * *', async function () {

        let return_moment = returnMoment();

        if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 1) {
            //destructAutoVirtualAcct();
            pushDepositNoti();
            onParentBrandSettle(return_moment);
        }
        if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 2) {
            popbillScraping();
            pushAsapMall(return_moment);
        }
        if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 3) {
            payConfirmProcess();
        }
    })
}

export default scheduleIndex;