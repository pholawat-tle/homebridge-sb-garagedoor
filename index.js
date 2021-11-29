"use strict";

const SwitchBot = new (require("node-switchbot"))();

var Service, Characteristic;

module.exports = (homebridge) => {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory(
        "homebridge-simple-garage-door-opener",
        "SimpleGarageDoorOpener",
        SimpleGarageDoorOpener
    );
};

class SimpleGarageDoorOpener {
    constructor(log, config) {
        //get config values
        this.name = config["name"];
        // this.doorSwitchPin = config["doorSwitchPin"] || 12;
        this.simulateTimeOpening = config["simulateTimeOpening"] || 10;
        this.simulateTimeOpen = config["simulateTimeOpen"] || 30;
        this.simulateTimeClosing = config["simulateTimeClosing"] || 10;

        this.switchBotID = config["BotMacBLE"] || "cbe116bab842";
        this.switchBotPW = config["BotPW"] || "";
        this.device = null;

        //initial setup
        this.log = log;
        this.lastOpened = new Date();
        this.service = new Service.GarageDoorOpener(this.name, this.name);
        this.setupGarageDoorOpenerService(this.service);

        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(
                Characteristic.Manufacturer,
                "Simple Garage Door"
            )
            .setCharacteristic(Characteristic.Model, "A Remote Control")
            .setCharacteristic(Characteristic.SerialNumber, "0711");
    }

    getServices() {
        return [this.informationService, this.service];
    }

    setupGarageDoorOpenerService(service) {
        SwitchBot.discover({
            quick: true,
            password: this.switchBotPW,
            id: this.switchBotID,
        })
            .then((device_list) => {
                this.device = device_list[0];
                if (!this.device) {
                    console.log("No device was found.");
                }
                console.log(
                    this.device.modelName +
                        " (" +
                        this.device.address +
                        ") was found."
                );
                console.log("Connecting...");
                return this.device.connect();
            })
            .then(() => {
                console.log("Connected");
            });

        // rpio.open(this.doorSwitchPin, rpio.OUTPUT, rpio.LOW);

        this.service.setCharacteristic(
            Characteristic.TargetDoorState,
            Characteristic.TargetDoorState.CLOSED
        );
        this.service.setCharacteristic(
            Characteristic.CurrentDoorState,
            Characteristic.CurrentDoorState.CLOSED
        );

        service
            .getCharacteristic(Characteristic.TargetDoorState)
            .on("get", (callback) => {
                var targetDoorState = service.getCharacteristic(
                    Characteristic.TargetDoorState
                ).value;
                if (
                    targetDoorState === Characteristic.TargetDoorState.OPEN &&
                    new Date() - this.lastOpened >= this.closeAfter * 1000
                ) {
                    this.log("Setting TargetDoorState -> CLOSED");
                    callback(null, Characteristic.TargetDoorState.CLOSED);
                } else {
                    callback(null, targetDoorState);
                }
            })
            .on("set", (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN) {
                    this.lastOpened = new Date();
                    switch (
                        service.getCharacteristic(
                            Characteristic.CurrentDoorState
                        ).value
                    ) {
                        case Characteristic.CurrentDoorState.CLOSED:
                        case Characteristic.CurrentDoorState.CLOSING:
                        case Characteristic.CurrentDoorState.OPEN:
                            this.openGarageDoor(callback);
                            break;
                        default:
                            callback();
                    }
                } else {
                    callback();
                }
            });
        console.log("Finish setting up garagedoor");
    }

    openGarageDoor(callback) {
        // rpio.write(this.doorSwitchPin, rpio.HIGH);
        this.device.down();
        SwitchBot.wait(500);
        this.device.up();

        this.log("Opening the garage door for...");
        this.simulateGarageDoorOpening();
        callback();
    }

    simulateGarageDoorOpening() {
        this.service.setCharacteristic(
            Characteristic.CurrentDoorState,
            Characteristic.CurrentDoorState.OPENING
        );
        setTimeout(() => {
            this.service.setCharacteristic(
                Characteristic.CurrentDoorState,
                Characteristic.CurrentDoorState.OPEN
            );
            setTimeout(() => {
                this.service.setCharacteristic(
                    Characteristic.CurrentDoorState,
                    Characteristic.CurrentDoorState.CLOSING
                );
                this.service.setCharacteristic(
                    Characteristic.TargetDoorState,
                    Characteristic.TargetDoorState.CLOSED
                );
                setTimeout(() => {
                    this.service.setCharacteristic(
                        Characteristic.CurrentDoorState,
                        Characteristic.CurrentDoorState.CLOSED
                    );
                }, this.simulateTimeClosing * 1000);
            }, this.simulateTimeOpen * 1000);
        }, this.simulateTimeOpening * 1000);
    }
}
