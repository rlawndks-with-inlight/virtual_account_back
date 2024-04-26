import _ from "lodash";
import shopDB, { shopPool } from "../../config/shopping-mall-db.js";


const insertQuery = async (table, obj) => {
    let keys = Object.keys(obj);
    if (keys.length == 0) {
        return false;
    }
    let question_list = keys.map(key => {
        return '?'
    });
    let values = keys.map(key => {
        return obj[key]
    });
    let result = await shopPool.query(`INSERT INTO ${table} (${keys.join()}) VALUES (${question_list.join()})`, values);
    return result;
}
const table_name = "transactions";

const shopProcess = async (params, products = []) => {
    //가상계좌노티
    try {
        let {
            amount,
            pay_type = "",
            acct_num,
            acct_name,
            bank_code,
            virtual_bank_code,
            virtual_acct_num,
            virtual_acct_name,
            tid,
            dns,
            created_at,
            phone_num
        } = params;
        let brand = await shopPool.query(`SELECT * FROM brands WHERE dns=?`, [dns]);
        brand = brand?.result[0];
        brand["theme_css"] = JSON.parse(brand?.theme_css ?? "{}");
        //brand["slider_css"] = JSON.parse(brand?.slider_css ?? "{}");
        brand["setting_obj"] = JSON.parse(brand?.setting_obj ?? "{}");
        brand["none_use_column_obj"] = JSON.parse(brand?.none_use_column_obj ?? "{}");
        brand["bonaeja_obj"] = JSON.parse(brand?.bonaeja_obj ?? "{}");
        brand["shop_obj"] = JSON.parse(brand?.shop_obj ?? "[]");
        brand["blog_obj"] = JSON.parse(brand?.blog_obj ?? "[]");
        brand["seo_obj"] = JSON.parse(brand?.seo_obj ?? "{}");
        if (!phone_num) {
            for (let i = 0; i < 8; i++) {
                const randomNumber = Math.floor(Math.random() * 10);
                phone_num += randomNumber.toString();
            }
            phone_num = '010' + phone_num
        }

        let random_addr = await shopPool.query(`SELECT * FROM user_addresses ORDER BY RAND() LIMIT 1`);
        random_addr = random_addr?.result[0];
        let obj = {
            brand_id: brand?.id,
            user_id: 0,
            tid,
            appr_num: tid,
            amount,
            item_name: 'asdasdsa',
            addr: '',
            detail_addr: '',
            buyer_name: acct_name,
            buyer_phone: phone_num,
            trx_method: 10,
            virtual_bank_code,
            virtual_acct_num,
            bank_code,
            acct_num,
            trx_dt: created_at.split(' ')[0],
            trx_tm: created_at.split(' ')[1],
            trx_status: 5,
        }
        if (pay_type == 'deposit') {
            obj['addr'] = random_addr?.addr;
            obj['detail_addr'] = random_addr?.detail_addr;
        } else if (pay_type == 'withdraw') {
            obj['is_cancel'] = 1;
        } else if (pay_type == 'return') {
            obj['is_cancel'] = 1;
        }
        await shopDB.beginTransaction();
        let result = await insertQuery(`${table_name}`, obj);
        let trans_id = result?.result?.insertId;
        if (pay_type == 'deposit') {
            // let products = await shopPool.query(`SELECT * FROM products WHERE brand_id=${brand?.id}`);
            // products = products?.result;
            let result_products = generateArrayWithSum(products, amount)
            let insert_item_data = [];
            for (var i = 0; i < result_products.length; i++) {
                insert_item_data.push([
                    trans_id,
                    parseInt(result_products[i]?.id),
                    result_products[i]?.product_name,
                    parseFloat(result_products[i]?.order_amount),
                    parseInt(result_products[i]?.order_count),
                    '[]',
                    result_products[i]?.delivery_fee,
                    0,
                    0,
                ]);
            }
            if (insert_item_data.length > 0) {
                let insert_item_result = await shopPool.query(
                    `INSERT INTO transaction_orders (trans_id, product_id, order_name, order_amount, order_count, order_groups, delivery_fee, seller_id, seller_trx_fee) VALUES ?`,
                    [insert_item_data]
                );
            }
        }

        await shopDB.commit();
        return {
            result: 100,
            message: 'success',
            data: {},
        };
    } catch (err) {
        await shopDB.rollback();
        console.log(err);
        return {
            result: -200,
            message: err?.response?.data?.result_msg || "서버 에러 발생",
            data: {},
        };
    } finally {

    }
}

function generateArrayWithSum(products_ = [], targetSum = 0) {
    if (products_.length == 0) {
        return [];
    }
    let products = products_;
    products = products.sort((a, b) => {
        if (a.product_sale_price > b.product_sale_price) return -1
        if (a.product_sale_price < b.product_sale_price) return 1
        return 0
    })
    // 난수 생성 함수
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 원하는 합에 도달할 때까지 임의의 숫자를 반복해서 추가
    let currentSum = 0;
    let resultArray = [];
    while (currentSum < targetSum) {
        if ((targetSum - currentSum) < 10000) {
            break;
        }
        let find_items = products.filter(el => parseInt(el?.product_sale_price) <= (targetSum - currentSum));
        let price = find_items[0]?.product_sale_price;
        let same_price_product_list = find_items.filter(el => el?.product_sale_price == price);
        let randomNumberIndex = getRandomInt(0, same_price_product_list.length - 1);
        let randomNumber = same_price_product_list[randomNumberIndex]?.product_sale_price;
        resultArray.push(same_price_product_list[randomNumberIndex]);
        currentSum += randomNumber;
        if ((targetSum - currentSum) <= 10000) {
            let last_find_items = products.filter(el => el?.product_sale_price <= (targetSum - currentSum))
            if (last_find_items.length > 0) {
                resultArray.push(last_find_items[0]);
                currentSum += last_find_items[0]?.product_sale_price;
            }
            break;
        }
    }
    let remain = targetSum - currentSum;
    let result = [];
    for (var i = 0; i < resultArray.length; i++) {
        let find_index = _.findIndex(result, { id: parseInt(resultArray[i]?.id) });
        if (find_index >= 0) {
            result[find_index].order_count++;
            result[find_index].order_amount += resultArray[i]?.product_sale_price;
        } else {
            result.push({ ...resultArray[i], order_count: 1, order_amount: resultArray[i]?.product_sale_price, delivery_fee: (i == 0 ? remain : 0) })
        }
    }
    // 합계가 원하는 값에 도달하면 배열 반환
    return result;
}

export {
    shopProcess
}