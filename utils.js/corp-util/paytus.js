

export const paytusApi = {
    bank: {
        list: async (data) => {
            try {
                let { dns_data, pay_type, decode_user, guid } = data;
                const bank_list = [
                    { value: '001', label: '한국은행', },
                    { value: '002', label: '산업은행', },
                    { value: '003', label: '기업은행', },
                    { value: '004', label: 'KB국민은행', },
                    { value: '007', label: '수협은행', },
                    { value: '008', label: '수출입은행', },
                    { value: '011', label: 'NH농협은행', },
                    { value: '012', label: '농축협(단위)', },
                    { value: '020', label: '우리은행', },
                    { value: '023', label: 'SC제일은행', },
                    { value: '027', label: '한국씨티', },
                    { value: '031', label: '대구은행', },
                    { value: '032', label: '부산은행', },
                    { value: '034', label: '광주은행', },
                    { value: '035', label: '제주은행', },
                    { value: '037', label: '전북은행', },
                    { value: '039', label: '경남은행', },
                    { value: '045', label: '새마을금고중앙회', },
                    { value: '048', label: '신협중앙회', },
                    { value: '050', label: '저축은행', },
                    { value: '064', label: '산림조합중앙회', },
                    { value: '071', label: '우체국', },
                    { value: '081', label: '하나은행', },
                    { value: '088', label: '신한은행', },
                    { value: '089', label: '케이뱅크', },
                    { value: '090', label: '카카오뱅크', },
                    { value: '092', label: '토스뱅크', },
                    { value: '105', label: '웰컴저축은행', },
                ]
                let result = {
                    code: 100,
                    message: 'success',
                    data: bank_list
                }
                return {
                    code: 100,
                    message: result?.message,
                    data: result.data,
                };
            } catch (err) {
                console.log(err);
                return {
                    code: -100,
                    message: '',
                    data: {},
                };
            }
        },
    },
}
