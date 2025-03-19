import when from "when";
import { readPool } from "../../config/db-pool.js";
import virtualAccountCtrl from "../../controllers/virtual_account.controller.js";
import { returnMoment } from "../function.js";

export const onDailyCleanVirtualAccountNotUseTwoWeeks = async (return_moment) => {
    if (!return_moment.includes('02:00:')) {
        return;
    }
    try {
        let brands = await readPool.query(`SELECT * FROM brands WHERE is_delete=0`);
        brands = brands[0];
        let left_2_weeks_deposit = await readPool.query(`SELECT id, created_at FROM deposits WHERE created_at >= CURDATE() - INTERVAL 14 DAY ORDER BY id ASC LIMIT 1`);
        left_2_weeks_deposit = left_2_weeks_deposit[0][0];
        for (var i = 0; i < brands.length; i++) {
            if (brands[i]?.deposit_corp_type == 6) {//코리아
                let result = await onProcessClean(brands[i], left_2_weeks_deposit);
            }
        }
    } catch (err) {
        console.log(err);
    }
}
if (parseInt(process.env.INSTANCE_ID) == parseInt(process.env.instances) - 1) {
    onDailyCleanVirtualAccountNotUseTwoWeeks('02:00:')
}
const onProcessClean = async (brand = {}, left_2_weeks_deposit = {}) => {
    try {
        let not_use_virtual_accounts = await readPool.query(`SELECT * FROM virtual_accounts WHERE brand_id=${brand?.id} AND is_delete=0 AND id NOT IN (SELECT virtual_account_id FROM deposits WHERE brand_id=${brand?.id} AND id >=${left_2_weeks_deposit?.id} AND virtual_account_id > 0) ORDER BY id ASC`);
        not_use_virtual_accounts = not_use_virtual_accounts[0];
        for (var i = 0; i < not_use_virtual_accounts.length / 100; i++) {
            let process_list = not_use_virtual_accounts.slice(i * 100, (i + 1) * 100);
            let result_list = [];
            for (var j = 0; j < process_list.length; j++) {
                result_list.push(virtualAccountCtrl.remove({ params: { id: process_list[j]?.id }, IS_RETURN: true, dns_data: brand }, {}));
            }
            for (var j = 0; j < result_list.length; j++) {
                await result_list[j];
            }
            let result = (await when(result_list));
        }
    } catch (err) {
        console.log(err);
    }

}
