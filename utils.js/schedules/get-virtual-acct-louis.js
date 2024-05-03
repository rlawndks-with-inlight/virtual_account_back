import axios from "axios";

const getVirAcctByLouis = async () => {
    try {
        const { data: get_constants } = await axios.post(`https://ji.sep-pay.com/api/member/free/get_constants`, {}, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8'
            }
        });
        console.log(get_constants)

    } catch (err) {
        console.log(err)
    }
}
export {
    getVirAcctByLouis
}