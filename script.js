let web3;
let contractData = {};

// แสดงข้อความแจ้งเตือนในหน้าเว็บ
function showAlert(message, elementId = 'result') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerText = message;
        console.log(message);
    } else {
        console.error(`Element with id ${elementId} not found`);
    }
}

// โหลด contract1.json และ contract2.json
async function loadContractData() {
    try {
        const abiResponse = await fetch('contract1.json');
        const bytecodeResponse = await fetch('contract2.json');
        contractData.abi = await abiResponse.json();
        contractData.bytecode = (await bytecodeResponse.json()).bytecode;
        console.log("Contract data loaded successfully");
    } catch (error) {
        console.error("Failed to load contract data:", error);
        showAlert("Failed to load contract data. Please check files.");
    }
}

// ตรวจสอบและสลับ network
async function ensureNetwork(chainId) {
    try {
        const currentChainId = await web3.eth.getChainId();
        if (currentChainId !== parseInt(chainId, 16)) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
            console.log(`Switched to chainId: ${chainId}`);
        } else {
            console.log(`Already on chainId: ${chainId}`);
        }
    } catch (error) {
        console.error("Network switch failed:", error);
        showAlert(`Failed to switch to BSC Testnet: ${error.message}`);
        throw error;
    }
}

// เชื่อมต่อ MetaMask
async function connectMetaMask() {
    if (!window.ethereum) {
        showAlert("Please install MetaMask!", 'error');
        return false;
    }
    try {
        web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) {
            showAlert("No accounts found. Please connect MetaMask.", 'error');
            return false;
        }
        console.log("Connected to MetaMask, account:", accounts[0]);
        return true;
    } catch (error) {
        console.error("MetaMask connection failed:", error);
        showAlert(`Failed to connect MetaMask: ${error.message}`, 'error');
        return false;
    }
}

// คำนวณค่า Gas Fee
async function calculateFees(params) {
    console.log("Calculating fees with params:", params);
    try {
        const contract = new web3.eth.Contract(contractData.abi);
        const deployData = contract.deploy({
            data: contractData.bytecode,
            arguments: [params.name, params.symbol, new web3.utils.BN(params.supply)]
        }).encodeABI();

        const gasPrice = new web3.utils.BN(await web3.eth.getGasPrice());
        const gasEstimate = new web3.utils.BN(await web3.eth.estimateGas({
            data: deployData,
            from: (await web3.eth.getAccounts())[0]
        }));
        const totalFee = gasPrice.mul(gasEstimate);

        console.log(`Gas Price: ${gasPrice.toString()}`);
        console.log(`Gas Estimate: ${gasEstimate.toString()}`);
        console.log(`Total Fee: ${totalFee.toString()} wei`);

        document.getElementById('fee').innerText = `${web3.utils.fromWei(totalFee, 'ether')} BNB`;
    } catch (error) {
        console.error("Fee calculation failed:", error);
        showAlert(`Fee calculation failed: ${error.message}`, 'fee');
    }
}

// Deploy contract
async function deployContract(params) {
    console.log("Deploying contract with params:", params);
    try {
        const accounts = await web3.eth.getAccounts();
        const contract = new web3.eth.Contract(contractData.abi);

        const deployTx = contract.deploy({
            data: contractData.bytecode,
            arguments: [params.name, params.symbol, new web3.utils.BN(params.supply)]
        });

        const gasPrice = new web3.utils.BN(await web3.eth.getGasPrice());
        const gasEstimate = new web3.utils.BN(await deployTx.estimateGas({ from: accounts[0] }));

        const deployedContract = await deployTx.send({
            from: accounts[0],
            gas: gasEstimate.toString(),
            gasPrice: gasPrice.toString()
        });

        console.log("Contract deployed at:", deployedContract.options.address);
        showAlert(`Contract deployed at: ${deployedContract.options.address}`);
    } catch (error) {
        console.error("Deployment failed:", error);
        showAlert(`Deployment failed: ${error.message}`);
    }
}

// บันทึกข้อมูล token จาก index.html
async function saveTokenData() {
    const tokenData = {
        name: document.getElementById('tokenName').value.trim(),
        symbol: document.getElementById('tokenSymbol').value.trim(),
        supply: document.getElementById('tokenSupply').value.trim(),
        logo: document.getElementById('tokenLogo').files[0] ? await readFileAsDataURL(document.getElementById('tokenLogo').files[0]) : '',
        network: document.getElementById('network').value
    };

    // ตรวจสอบข้อมูล
    if (!tokenData.name || !tokenData.symbol || !tokenData.supply) {
        showAlert("Please fill in all required fields (Name, Symbol, Supply).", 'error');
        return;
    }
    if (isNaN(tokenData.supply) || tokenData.supply <= 0) {
        showAlert("Supply must be a positive number.", 'error');
        return;
    }

    localStorage.setItem('tokenData', JSON.stringify(tokenData));
    console.log("Token data saved:", tokenData);
    window.location.href = 'deploy.html';
}

// อ่านไฟล์เป็น Data URL
function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// เริ่มต้นหน้าเว็บ
window.onload = async () => {
    console.log("Window loaded");

    // ตรวจสอบและเชื่อมต่อ MetaMask
    const isConnected = await connectMetaMask();
    if (!isConnected && window.location.pathname.includes('deploy.html')) {
        showAlert("Please connect MetaMask to continue.");
        window.location.href = 'index.html';
        return;
    }

    // จัดการการเปลี่ยนแปลงบัญชีหรือ network ใน MetaMask
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', async (accounts) => {
            console.log("Accounts changed:", accounts);
            if (accounts.length === 0) {
                showAlert("MetaMask disconnected. Please reconnect.", 'error');
                window.location.href = 'index.html';
            }
        });
        window.ethereum.on('chainChanged', () => {
            console.log("Network changed");
            window.location.reload();
        });
    }

    // ถ้าเป็น deploy.html
    if (window.location.pathname.includes('deploy.html')) {
        const tokenData = JSON.parse(localStorage.getItem('tokenData'));
        if (!tokenData) {
            showAlert("No token data found. Please create a token first.");
            window.location.href = 'index.html';
            return;
        }
        console.log("Token data loaded in deploy.html:", tokenData);

        await loadContractData();

        // ตรวจสอบ network
        try {
            await ensureNetwork('0x61'); // BSC Testnet
        } catch (error) {
            return;
        }

        // คำนวณ fee
        await calculateFees(tokenData);

        // เมื่อกดปุ่ม Deploy
        const deployButton = document.getElementById('deployButton');
        if (deployButton) {
            deployButton.onclick = async () => {
                await deployContract(tokenData);
            };
        }
    }

    // ถ้าเป็น index.html
    const createButton = document.getElementById('createToken');
    if (createButton) {
        createButton.onclick = async () => {
            const isConnected = await connectMetaMask();
            if (isConnected) {
                await saveTokenData();
            }
        };
    }
};