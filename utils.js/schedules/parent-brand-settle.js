import { pool } from "../../config/db.js";
import { returnMoment } from "../function.js";
import { insertQuery, updateQuery } from "../query-util.js";
import { commarNumber } from "../util.js";

export const onParentBrandSettle = async (return_moment = "") => {
    if (!return_moment.includes('23:55:')) {
        return;
    }
    try {
        let children_brands = await pool.query(`SELECT * FROM brands WHERE parent_id > 0`);
        children_brands = children_brands?.result;
        for (var i = 0; i < children_brands.length; i++) {
            let children_brand = children_brands[i];
            children_brand['setting_obj'] = JSON.parse(children_brand?.setting_obj ?? '{}');
            if (children_brand?.setting_obj?.is_auto_parent_brand_settle != 1) {
                continue;
            }
            parentBrandSettle(children_brand, return_moment);
        }
    } catch (err) {
        console.log(err);
    }
}
const parentBrandSettle = async (brand = {}, return_moment = "") => {
    try {
        let insert_list = [];
        console.log(brand)
        console.log(return_moment)
        let yesterday = returnMoment(false, -1);
        let deposit_sql = `SELECT SUM(amount) AS amount, COUNT(*) AS total FROM deposits`;
        deposit_sql += ` WHERE brand_id=${brand?.id} `;
        deposit_sql += ` AND deposit_status=0 `;
        deposit_sql += ` AND pay_type=0 `;
        deposit_sql += ` AND (created_at BETWEEN '${return_moment.substring(0, 10)} 00:00:00' AND '${return_moment.substring(0, 10)} 23:59:59' )`;
        console.log(deposit_sql)
        let deposit_sum = await pool.query(deposit_sql);
        deposit_sum = deposit_sum?.result[0];
        if (brand?.is_use_fee_operator == 1) {
            insert_list.push([//요율
                brand?.id,
                12,
                parseInt((brand?.head_office_fee * deposit_sum?.amount / 100).toFixed()),
                `입금요율 ${commarNumber(deposit_sum?.amount)} 원의 ${brand?.head_office_fee}% 차감`,
                1,
            ])
        }
        insert_list.push([//수수료
            brand?.id,
            12,
            (deposit_sum?.total * brand?.deposit_head_office_fee),
            `입금수수료 ${commarNumber(deposit_sum?.total)} 회 입금 X  ${brand?.deposit_head_office_fee}원 차감`,
            1,
        ])
        let withdraw_sql = `SELECT COUNT(*) AS total FROM deposits`;
        withdraw_sql += withdrawWheresql(brand, yesterday, return_moment)



        let withdraw_sum = await pool.query(withdraw_sql);
        withdraw_sum = withdraw_sum?.result[0];
        insert_list.push([//수수료
            brand?.id,
            12,
            (withdraw_sum?.total * brand?.withdraw_head_office_fee),
            `입금수수료 ${commarNumber(withdraw_sum?.total)} 회 출금 X  ${brand?.withdraw_head_office_fee}원 차감`,
            1,
        ])

        let withdraw_id_sql = `SELECT id FROM deposits`;
        withdraw_id_sql += withdrawWheresql(brand, yesterday, return_moment)
        let withdraw_id_list = await pool.query(withdraw_id_sql);
        withdraw_id_list = withdraw_id_list?.result;

        let result_insert_list = [];
        for (var i = 0; i < insert_list.length; i++) {
            if (insert_list[i][2] > 0) {
                insert_list[i][2] = (-1) * insert_list[i][2];
                result_insert_list.push(insert_list[i]);
            }
        }

        let result = await pool.query(`INSERT INTO deposits (brand_id, pay_type, amount, note, is_parent_brand_settle) VALUES ?`, [result_insert_list]);
        let sucess_result = await insertQuery(`parent_brand_settles`, {
            brand_id: brand?.id,
            parent_id: brand?.parent_id,
            date: return_moment.substring(0, 10),
            status: 0,
        })
        let success_id = sucess_result?.result?.insertId;
        if (result.code > 0) {
            if (withdraw_id_list.length > 0) {
                for (var i = 0; i < withdraw_id_list.length / 1000; i++) {
                    let update_withdraw_list = withdraw_id_list.slice(i * 1000, (i + 1) * 1000);
                    let update_result = await pool.query(`UPDATE deposits SET  is_confirm_parent_brand_settle=1 WHERE id IN (${update_withdraw_list.map(itm => itm?.id).join()})`);
                }
            }
        }

        sucess_result = await updateQuery(`parent_brand_settles`, {
            status: 1,
        }, success_id)
    } catch (err) {
        console.log(err);
    }
}
const withdrawWheresql = (brand, yesterday, return_moment) => {
    let withdraw_sql = ``;
    withdraw_sql += ` WHERE brand_id=${brand?.id} `;
    withdraw_sql += ` AND withdraw_status=0 `;
    withdraw_sql += ` AND pay_type IN (5, 10, 20) `;
    withdraw_sql += ` AND (created_at BETWEEN '${yesterday.substring(0, 10)} 00:00:00' AND '${return_moment.substring(0, 10)} 23:59:59' )`;
    withdraw_sql += ` AND is_confirm_parent_brand_settle=0 `;
    withdraw_sql += ` AND id >= 1375976 `;
    return withdraw_sql
}