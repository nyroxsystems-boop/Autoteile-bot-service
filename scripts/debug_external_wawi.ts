
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = process.env.INVENTREE_BASE_URL;
const API_TOKEN = process.env.INVENTREE_API_TOKEN;

console.log('--- External Wawi Connection Debug ---');
console.log(`URL: ${BASE_URL}`);
console.log(`Token: ${API_TOKEN ? 'Set' : 'Missing'}`);

async function testConnection() {
    if (!BASE_URL) {
        console.error('❌ INVENTREE_BASE_URL is not set');
        return;
    }

    try {
        console.log('\n1. Testing Root API Access (/api/)...');
        const rootRes = await axios.get(`${BASE_URL}/api/`, {
            headers: {
                'Authorization': `Token ${API_TOKEN}`
            },
            timeout: 10000,
            validateStatus: () => true // Accept all status codes
        });
        console.log(`Status: ${rootRes.status} ${rootRes.statusText}`);
        console.log(`Headers:`, rootRes.headers);
        console.log(`Data (snippet):`, JSON.stringify(rootRes.data).substring(0, 200));

    } catch (error: any) {
        console.error('❌ Root Access Failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
        }
    }

    try {
        console.log('\n2. Testing Company List (/api/company/)...');
        const companyRes = await axios.get(`${BASE_URL}/api/company/`, {
            headers: {
                'Authorization': `Token ${API_TOKEN}`
            },
            timeout: 10000,
            validateStatus: () => true
        });
        console.log(`Status: ${companyRes.status} ${companyRes.statusText}`);
        console.log(`Data (snippet):`, JSON.stringify(companyRes.data).substring(0, 200));

    } catch (error: any) {
        console.error('❌ Company List Failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
        }
    }
}

testConnection();
