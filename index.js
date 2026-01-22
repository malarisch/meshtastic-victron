
import * as Protobuf from "@meshtastic/protobufs";
import { create, toBinary } from "@bufbuild/protobuf";

import { MeshDevice, Protobuf as CoreProtobuf } from "@meshtastic/core";
import { TransportNode } from "@meshtastic/transport-node";

// Telemetry Schemas aus dem Protobuf Namespace
const { TelemetrySchema, DeviceMetricsSchema, PowerMetricsSchema } = Protobuf.Telemetry;

var config = {
	sendInterval: 600000,
	useMockVictron: false,
	sendData: true,
	meshChannel: 1,
	victronCliPath: 'victron-ble',
	victronMacAddr: null,
	victronPasskey: null,
	meshtasticIp: 'localhost'
};




function loadConfig() {
	// Here you can load configuration from a file or environment variables
	// For simplicity, we are using hardcoded values in this example
	const configPath = './config.json';
	if (fs.existsSync(configPath)) {
		const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		config = { ...config, ...fileConfig };
	} else {
		saveConfig(); // Save default config if file doesn't exist
	}
	console.log("Loaded config:", config);
}

function saveConfig() {
	const configPath = './config.json';
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
	console.log("Saved config:", config);
}

loadConfig();

const transport = await TransportNode.create(config.meshtasticIp);
const device = new MeshDevice(transport);

device.events.onMessagePacket.subscribe(handleMessagePacket);


function configure() {
	device.configure().then(() => {
		console.log("Configuration applied");
	}).catch((err) => {
		console.error("Error applying configuration:", err);
	});
}
configure();
console.log("Device configured and ready to receive messages!")

//console.log(await device.getConfig())
function batteryPercentageFromVoltage(voltage) {
	// Berechnet den State of Charge (SOC) für ein 4S Li-Ion Pack
	// 4S voll: 4.2V × 4 = 16.8V
	// 4S leer: 3.0V × 4 = 12.0V (konservativ: 3.2V × 4 = 12.8V)
	const level_high = config.batteryBatteryLevelHigh;
	const level_low = config.batteryBatteryLevelLow;
	
	if (voltage >= level_high) return 100;
	if (voltage <= level_low) return 0;
	
	const percentage = ((voltage - level_low) / (level_high - level_low)) * 100;
	return Math.round(percentage);
}


async function sendTelemetry() {
	// Hole die neuesten Victron-Daten
	newVicData = getAccumulatedVictronData()
	if (!newVicData || newVicData.packet_count === 0) {
		console.log("No Victron data available for telemetry");
		return;
	}
	
	// Solar-Berechnungen
	const battery_voltage = parseFloat(newVicData.battery_voltage);
	
	// Erstelle DeviceMetrics mit Batterie-Informationen
	const deviceMetrics = create(DeviceMetricsSchema, {
		voltage: battery_voltage,
		batteryLevel: batteryPercentageFromVoltage(battery_voltage)
	});

	

	// Erstelle das Telemetry-Paket mit deviceMetrics
	const deviceTelemetry = create(TelemetrySchema, {
		time: Math.floor(Date.now() / 1000),
		variant: {
			case: "deviceMetrics",
			value: deviceMetrics
		}
	});

	// Erstelle das Telemetry-Paket mit powerMetrics
	const powerTelemetry = create(TelemetrySchema, {
		time: Math.floor(Date.now() / 1000),
		variant: {
			case: "powerMetrics",
			value: powerMetrics
		}
	});

	try {
		// Sende DeviceMetrics
		const deviceTelemetryBytes = toBinary(TelemetrySchema, deviceTelemetry);
		await device.sendPacket(
			deviceTelemetryBytes,
			CoreProtobuf.Portnums.PortNum.TELEMETRY_APP,
			"broadcast",
			config.meshChannel,
			false,  // wantAck
			false   // wantResponse
		);
		
		
		
		console.log("Telemetry sent successfully:", {
			batteryVoltage: battery_voltage,
			batteryLevel: batteryPercentageFromVoltage(battery_voltage)
			
		});
	} catch (err) {
		console.log("Telemetry sent error:", {
			batteryVoltage: battery_voltage,
			batteryLevel: batteryPercentageFromVoltage(battery_voltage)
		});
		console.error("Error sending telemetry:", err);
	}
}


function handleMessagePacket(meshPacket) {
	console.log("Received Message Packet:", meshPacket);
	if (meshPacket.channel !== config.meshChannel) {
		console.log("Ignoring message on different channel:", meshPacket.channel);
		return;
	}
	if (meshPacket.from === 0 || meshPacket.from == device.myNodeInfo.deviceId.buffer.toString || meshPacket.from === device.myNodeInfo.myNodeNum) {
		// Ignore messages from self or the gateway
		console.log("Ignoring message from self or gateway:", meshPacket.from);
		return;
	}
	const splittedText = meshPacket.data.split(" ");
	if (splittedText[0] === "cfg") {
		if (splittedText[1] === "sendInterval" && splittedText.length === 3) {
			const newInterval = parseInt(splittedText[2]);
			if (!isNaN(newInterval) && newInterval >= 10000) {
				config.sendInterval = newInterval;
				saveConfig();
				sendMessage("cfg sendInterval set to " + newInterval);
				if (config.sendData) {
					clearInterval(sendingIntervalId);
					sendingIntervalId = startSendingData();
				}
			} else {
				sendMessage("cfg sendInterval invalid value");
			}
		} else if (splittedText[1] === "sendData" && splittedText.length === 3) {
			const newEnabled = splittedText[2].toLowerCase();
			if (newEnabled === "true" || newEnabled === "false") {
				config.sendData = (newEnabled === "true");
				saveConfig();
				sendMessage("cfg sendData set to " + config.sendData);
				if (config.sendData) {
					clearInterval(sendingIntervalId);
					sendingIntervalId = startSendingData();
				} else {
					if (sendingIntervalId) {
						clearInterval(sendingIntervalId);
						sendingIntervalId = null;
					}
				}
			} else {
				sendMessage("cfg sendData invalid value");
			}

		} else if (splittedText[1] === "sendTelemetry" && splittedText.length === 2) {
			sendTelemetry().then(() => {
				console.log("Telemetry command processed");
			}).catch((err) => {
				console.error("Error processing telemetry command:", err);
			});
		} else {
			sendMessage("cfg unknown command");
		}
	}

}

import { exec, spawn } from 'child_process';
import fs from 'fs';

var child = null;



function sendMessage(text, cb) {

	device.sendText(text, undefined, true, config.meshChannel).then(() => {
		console.log("Sent message:", text);
	}).catch((err) => {
		console.error("Error sending message:", err);
	}).finally(() => {
		if (cb) cb();
	});
	//var args = [...meshtasticArgs, '"' + text + '"']
	//exec(meshtasticCmd + " " + args.join(" "), (err, stdout, stderr) => {
	//	if (err) {
	//		console.error(err);
	//		return;
	//	}
	//	console.log(stdout);
	//});

}

//sendMessage("script online")
// You can also use a variable to save the output 
// for when the script closes later
var victronInfoCount = 0;

function initVictronInfo() {
	return {
		battery_charging_current: 0,
		battery_voltage: 0,
		charge_state: 'null',
		charger_error: null,
		external_device_load: 0,
		solar_power: 0,
		yield_today: 0
	};
}
var victronInfo = initVictronInfo();

function getAccumulatedVictronData() {
	const returnVal = {
		battery_charging_current: (victronInfo.battery_charging_current / victronInfoCount).toFixed(2),
		battery_voltage: (victronInfo.battery_voltage / victronInfoCount).toFixed(2),
		charge_state: victronInfo.charge_state,
		charger_error: victronInfo.charger_error,
		external_device_load: (victronInfo.external_device_load / victronInfoCount).toFixed(2),
		solar_power: (victronInfo.solar_power / victronInfoCount).toFixed(2),
		yield_today: (victronInfo.yield_today / victronInfoCount).toFixed(2),
		packet_count: victronInfoCount
	}
	victronInfoCount = 0;
	victronInfo = initVictronInfo();
	return returnVal;
}

function getVictronDataString(data) {
	if (data.battery_voltage == NaN) return "VIC data_incomplete"
	if (data.packet_count == 0) return "VIC disconnected"
	let retString = "VIC bv" + data.battery_voltage + " bi" + data.battery_charging_current + " ei" +
		data.external_device_load + " sp" + data.solar_power + " yt" + data.yield_today + " cs" + data.charge_state

	if (data.charger_error !== "no_error" && data.charger_error !== null) retString += " ce" + data.charger_error
	return retString;
}
var newVicData = null;
var sendingIntervalId = null;
var startSendingData = function () {
	return setInterval(() => {
		newVicData = getAccumulatedVictronData();
		console.log("NewVicData", newVicData)
		const dataString = getVictronDataString(newVicData)
		console.log(dataString)
		sendMessage(dataString, () => {
			console.log("Victron data sent");
			sendTelemetry().then(() => {
				console.log("Telemetry sent after Victron data");
			}).catch((err) => {
				console.error("Error sending telemetry after Victron data:", err);
			});
		});
		
	}, config.sendInterval)
}

if (config.sendData) {
	sendingIntervalId = startSendingData();
}

var victronMockIntervalId = null;
function startVictronMockProcess() {
	// Simulate Victron data for testing
	victronMockIntervalId = setInterval(() => {
		victronInfoCount += 1;
		victronInfo.battery_voltage += 14 + Math.random(); // Simulate around 14V
		victronInfo.battery_charging_current += 5 + Math.random() * 2; // Simulate around 5A
		victronInfo.charge_state = 'bulk';
		victronInfo.charger_error = 'no_error';
		victronInfo.external_device_load += 1 + Math.random(); // Simulate around 1A
		victronInfo.solar_power += 50 + Math.random() * 10; // Simulate around 50W
		victronInfo.yield_today += 100 + Math.random() * 20; // Simulate around 100Wh
	}, 1000);
}
function stopVictronMockProcess() {
	if (victronMockIntervalId) {
		clearInterval(victronMockIntervalId);
		victronMockIntervalId = null;
	}
}

if (config.useMockVictron) {
	startVictronMockProcess();
} else {
	startVictronChildProcess();
}

function startVictronChildProcess() {
	// Already started above
	child = spawn(config.victronCliPath, ["read", config.victronMacAddr + "@" + config.victronPasskey]);

	child.stdout.setEncoding('utf8');
	child.stdout.on('data', function (data) {
		//Here is where the output goes

		//console.log('stdout: ' + data);
		try {
			data = data.toString();
			const currentVictronJson = JSON.parse(data);
			//console.log("Json:", currentVictronJSON)
			victronInfoCount += 1;
			victronInfo.battery_voltage += currentVictronJson.payload.battery_voltage;
			victronInfo.battery_charging_current += currentVictronJson.payload.battery_charging_current;
			victronInfo.charge_state = currentVictronJson.payload.charge_state;
			victronInfo.charger_error = currentVictronJson.payload.charger_error;
			victronInfo.external_device_load += currentVictronJson.payload.external_device_load
			victronInfo.solar_power += currentVictronJson.payload.solar_power;
			victronInfo.yield_today = currentVictronJson.payload.yield_today;
		} catch (e) {
			console.error(e)
		}
	});

	child.stderr.setEncoding('utf8');
	child.stderr.on('data', function (data) {
		//Here is where the error output goes

		console.log('stderr: ' + data);

		data = data.toString();
		//scriptOutput+=data;
	});

	child.on('close', function (code) {
		//Here you can get the exit code of the script

		console.log('closing code: ' + code);

		console.log('Full output of script: ', scriptOutput);
	});

}
