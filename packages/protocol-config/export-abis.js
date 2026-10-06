const fs = require('fs');
const path = require('path');

const contractsDir = path.resolve(__dirname, '../../contracts/out');
const targetAbisDir = path.resolve(__dirname, 'abis');

if (!fs.existsSync(targetAbisDir)) {
  fs.mkdirSync(targetAbisDir, { recursive: true });
}

const contracts = ['BeaconLiteVault', 'WithdrawalQueue', 'MockValidatorAdapter'];

for (const name of contracts) {
  const artifactPath = path.join(contractsDir, `${name}.sol`, `${name}.json`);
  if (fs.existsSync(artifactPath)) {
    const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    fs.writeFileSync(
      path.join(targetAbisDir, `${name}.json`),
      JSON.stringify(data.abi, null, 2)
    );
    console.log(`Exported ABI for ${name}`);
  } else {
    console.warn(`Artifact not found: ${artifactPath}`);
  }
}
