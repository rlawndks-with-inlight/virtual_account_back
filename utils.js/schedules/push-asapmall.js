import 'dotenv/config';
import axios from 'axios';
import { insertQuery, updateQuery } from '../query-util.js';
import { returnMoment } from '../function.js';
import { shopProcess } from './shop-process.js';
import { shopPool } from '../../config/shopping-mall-db.js';
import _ from 'lodash';
import { readPool } from '../../config/db-pool.js';

export const pushAsapMall = async (return_moment = "") => {
    try {
        let moment_list = [
            ':00:00',
            ':05:00',
            ':10:00',
            ':15:00',
            ':20:00',
            ':25:00',
            ':30:00',
            ':35:00',
            ':40:00',
            ':45:00',
            ':50:00',
            ':55:00',
        ];
        let is_process_func = false;
        let minute = '';
        for (var i = 0; i < moment_list.length; i++) {
            if (return_moment.includes(moment_list[i])) {
                is_process_func = true;
                minute = moment_list[i].split(':')[1];
                break;
            }
        }
        if (!is_process_func) {
            return;
        }
        let use_brand_columns = [
            `brands.id`,
            `brands.asapmall_dns`,
            `brands.asapmall_back_dns`,
            `brands.deposit_type`,
            `brands.is_use_asapmall_noti`,
        ]
        let use_brands = await readPool.query(`SELECT ${use_brand_columns.join()} FROM brands WHERE is_use_asapmall_noti=1`);
        use_brands = use_brands[0];
        let use_brand_ids = use_brands.map(el => { return el?.id });

        let deposit_columns = [
            'id',
            'pay_type',
            'amount',
            'withdraw_fee',
            'trx_id',
            'deposit_acct_name',
            'settle_bank_code',
            'settle_acct_name',
            'settle_acct_num',
            'created_at',
            'virtual_account_id',
            'brand_id',
        ]
        let sql = ` SELECT ${deposit_columns.join()} FROM deposits `;
        //sql += ` LEFT JOIN virtual_accounts ON deposits.virtual_account_id=virtual_accounts.id `;
        sql += ` WHERE deposits.brand_id IN (${use_brand_ids.join()}) `;
        sql += ` AND deposits.pay_type IN (0, 5, 20) `;
        sql += ` AND deposits.send_asapmall_noti=5 `;
        sql += ` AND deposits.amount!=0 `;
        sql += ` ORDER BY deposits.id ASC `;

        let insert_log = await insertQuery('logs', {
            brand_id: 66,
            request: JSON.stringify({
                type: 'send_asap'
            }),
            response_data: '{}',
            response_result: 100,
            response_message: '스케줄링 시작',
            user_id: -1,
        })

        let data = await readPool.query(sql);
        data = data[0];

        let virtual_account_ids = data.filter(el => el?.virtual_account_id > 0).map(el => { return el?.virtual_account_id });
        virtual_account_ids = new Set(virtual_account_ids);
        virtual_account_ids = [...virtual_account_ids];
        let use_virtual_accounts = await readPool.query(`SELECT id, phone_num FROM virtual_accounts WHERE id IN (${virtual_account_ids.join()})`);
        use_virtual_accounts = use_virtual_accounts[0];

        for (var i = 0; i < data.length; i++) {
            let brand = _.find(use_brands, { id: data[i]?.brand_id });
            let virtual_account = _.find(use_virtual_accounts, { id: data[i]?.virtual_account_id });
            data[i] = {
                ...data[i],
                asapmall_dns: brand?.asapmall_dns,
                asapmall_back_dns: brand?.asapmall_back_dns,
                deposit_type: brand?.deposit_type,
                is_use_asapmall_noti: brand?.is_use_asapmall_noti,
                phone_num: virtual_account?.phone_num,
            }
        }

        let is_stop_func = false;

        let shop_brands = await shopPool.query(`SELECT id, dns FROM brands`);
        shop_brands = shop_brands[0];

        let brand_product_obj = {};
        for (var i = 0; i < data.length; i++) {
            let cur_minute = returnMoment().split(' ')[1].split(':')[1];
            for (var j = 0; j < moment_list.length; j++) {
                let side_minute = moment_list[j].split(':')[1];
                if (cur_minute == side_minute && cur_minute != minute) {
                    is_stop_func = true;
                    break;
                }
            }
            if (is_stop_func) {
                break;
            }

            let {
                asapmall_dns,
                asapmall_back_dns,
                pay_type,
                amount,
                withdraw_fee,
                trx_id,
                deposit_acct_name,
                settle_bank_code,
                settle_acct_name,
                settle_acct_num,
                id,
                created_at,
                phone_num,
                deposit_type
            } = data[i];


            if (amount > 0 || amount < 0) {
                let products = [];
                if (!brand_product_obj[asapmall_dns]) {
                    let shop_brand = _.find(shop_brands, { dns: asapmall_dns });
                    products = await shopPool.query(`SELECT * FROM products WHERE brand_id=${shop_brand?.id}`);
                    products = products[0];

                    brand_product_obj[asapmall_dns] = products;
                } else {
                    products = brand_product_obj[asapmall_dns];
                }

                let obj = {
                    dns: asapmall_dns,
                    amount: amount,
                    tid: trx_id,
                    created_at,
                    phone_num,
                    deposit_type,
                };
                if (pay_type == 0) {
                    obj['pay_type'] = 'deposit';
                    obj['acct_name'] = deposit_acct_name;

                } else if (pay_type == 5) {
                    obj['pay_type'] = 'withdraw';
                    obj['amount'] = amount + withdraw_fee;
                    obj['acct_name'] = settle_acct_name;
                    obj['acct_num'] = settle_acct_num;
                    obj['bank_code'] = settle_bank_code;


                } else if (pay_type == 20) {
                    obj['pay_type'] = 'return';
                    obj['amount'] = amount + withdraw_fee;
                    obj['acct_name'] = settle_acct_name;
                    obj['acct_num'] = settle_acct_num;
                    obj['bank_code'] = settle_bank_code;
                }
                sendNotiPushAsapMall(data[i], obj, products)
                await new Promise((r) => setTimeout(r, 5));
                if (i % 1000 == 0) {
                    console.log(i);
                }
            }
        }
        console.log('success');
    } catch (err) {
        console.log(err);
    }
}
const sendNotiPushAsapMall = async (data, obj, products = []) => {
    try {
        let {
            asapmall_dns,
            asapmall_back_dns,
            pay_type,
            amount,
            withdraw_fee,
            trx_id,
            deposit_acct_name,
            settle_acct_name,
            id,
            created_at
        } = data;
        let result = await shopProcess(obj, products);
        if (result?.result > 0) {
            let result = await updateQuery(`deposits`, {
                send_asapmall_noti: 0,
            }, id)
        }
    } catch (err) {
        console.log(err);
    }
}