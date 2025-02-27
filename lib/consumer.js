"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Consumer = void 0;
const events = require("events");
const message_1 = require("./message");
const utils_1 = require("./utils");
class Consumer {
    constructor(connection, stationName, consumerName, consumerGroup, pullIntervalMs, batchSize, batchMaxTimeToWaitMs, maxAckTimeMs, maxMsgDeliveries, startConsumeFromSequence, lastMessages) {
        this.connection = connection;
        this.stationName = stationName.toLowerCase();
        this.internalStationName = this.stationName.replace(/\./g, '#');
        this.consumerName = consumerName.toLowerCase();
        this.internalConsumerName = this.consumerName.replace(/\./g, '#');
        this.consumerGroup = consumerGroup.toLowerCase();
        this.internalConsumerGroupName = this.consumerGroup.replace(/\./g, '#');
        this.pullIntervalMs = pullIntervalMs;
        this.batchSize = batchSize;
        this.batchMaxTimeToWaitMs = batchMaxTimeToWaitMs;
        this.maxAckTimeMs = maxAckTimeMs;
        this.maxMsgDeliveries = maxMsgDeliveries;
        this.eventEmitter = new events.EventEmitter();
        this.pullInterval = null;
        this.pingConsumerInvtervalMs = 30000;
        this.pingConsumerInvterval = null;
        this.startConsumeFromSequence = startConsumeFromSequence;
        this.lastMessages = lastMessages;
        this.context = {};
        this.realName = consumerName.toLowerCase();
        this.dlsMessages = [];
        this.dlsCurrentIndex = 0;
        const sub = this.connection.brokerManager.subscribe(`$memphis_dls_${this.internalStationName}_${this.internalConsumerGroupName}`, {
            queue: `$memphis_${this.internalStationName}_${this.internalConsumerGroupName}`
        });
        this._handleAsyncIterableSubscriber(sub, true);
    }
    setContext(context) {
        this.context = context;
    }
    on(event, cb) {
        if (event === 'message') {
            this.connection.brokerConnection
                .pullSubscribe(`${this.internalStationName}.final`, {
                mack: true,
                config: {
                    durable_name: this.consumerGroup ? this.internalConsumerGroupName : this.internalConsumerName
                }
            })
                .then(async (psub) => {
                psub.pull({
                    batch: this.batchSize,
                    expires: this.batchMaxTimeToWaitMs
                });
                this.pullInterval = setInterval(() => {
                    var _a;
                    if (((_a = this === null || this === void 0 ? void 0 : this.connection) === null || _a === void 0 ? void 0 : _a.brokerManager) && !this.connection.brokerManager.isClosed())
                        psub.pull({
                            batch: this.batchSize,
                            expires: this.batchMaxTimeToWaitMs
                        });
                    else
                        clearInterval(this.pullInterval);
                }, this.pullIntervalMs);
                this.pingConsumerInvterval = setInterval(async () => {
                    var _a;
                    if (((_a = this === null || this === void 0 ? void 0 : this.connection) === null || _a === void 0 ? void 0 : _a.brokerManager) && !this.connection.brokerManager.isClosed()) {
                        this._pingConsumer();
                    }
                    else
                        clearInterval(this.pingConsumerInvterval);
                }, this.pingConsumerInvtervalMs);
                this._handleAsyncIterableSubscriber(psub, false);
            })
                .catch((error) => this.eventEmitter.emit('error', (0, utils_1.MemphisError)(error)));
        }
        this.eventEmitter.on(event, cb);
    }
    async fetch() {
        var e_1, _a;
        try {
            let messages = [];
            if (this.dlsMessages.length > 0) {
                if (this.dlsMessages.length <= this.batchSize) {
                    messages = this.dlsMessages;
                    this.dlsMessages = [];
                    this.dlsCurrentIndex = 0;
                }
                else {
                    messages = this.dlsMessages.splice(0, this.batchSize);
                    this.dlsCurrentIndex -= messages.length;
                }
                return messages;
            }
            const durableName = this.consumerGroup ? this.internalConsumerGroupName : this.internalConsumerName;
            const batch = await this.connection.brokerConnection.fetch(this.internalStationName, durableName, { batch: this.batchSize, expires: this.batchMaxTimeToWaitMs });
            try {
                for (var batch_1 = __asyncValues(batch), batch_1_1; batch_1_1 = await batch_1.next(), !batch_1_1.done;) {
                    const m = batch_1_1.value;
                    messages.push(new message_1.Message(m, this.connection, this.consumerGroup));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (batch_1_1 && !batch_1_1.done && (_a = batch_1.return)) await _a.call(batch_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return messages;
        }
        catch (ex) {
            throw (0, utils_1.MemphisError)(ex);
        }
    }
    async _handleAsyncIterableSubscriber(iter, isDls) {
        var e_2, _a;
        try {
            for (var iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = await iter_1.next(), !iter_1_1.done;) {
                const m = iter_1_1.value;
                if (isDls) {
                    let indexToInsert = this.dlsCurrentIndex;
                    if (this.dlsCurrentIndex >= 10000) {
                        indexToInsert %= 10000;
                    }
                    this.dlsMessages[indexToInsert] = new message_1.Message(m, this.connection, this.consumerGroup);
                    this.dlsCurrentIndex++;
                }
                this.eventEmitter.emit('message', new message_1.Message(m, this.connection, this.consumerGroup), this.context);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (iter_1_1 && !iter_1_1.done && (_a = iter_1.return)) await _a.call(iter_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    async _pingConsumer() {
        try {
            const stationName = this.stationName.replace(/\./g, '#').toLowerCase();
            const consumerGroup = this.consumerGroup.replace(/\./g, '#').toLowerCase();
            const consumerName = this.consumerName.replace(/\./g, '#').toLowerCase();
            const durableName = consumerGroup || consumerName;
            await this.connection.brokerStats.consumers.info(stationName, durableName);
        }
        catch (ex) {
            this.eventEmitter.emit('error', (0, utils_1.MemphisError)(new Error('station/consumer were not found')));
        }
    }
    async destroy() {
        var _a;
        clearInterval(this.pullInterval);
        try {
            let removeConsumerReq = {
                name: this.consumerName,
                station_name: this.stationName,
                username: this.connection.username
            };
            let data = this.connection.JSONC.encode(removeConsumerReq);
            let errMsg = await this.connection.brokerManager.request('$memphis_consumer_destructions', data);
            errMsg = errMsg.data.toString();
            if (errMsg != '') {
                throw (0, utils_1.MemphisError)(new Error(errMsg));
            }
            this.connection._unSetCachedConsumer(this);
        }
        catch (ex) {
            if ((_a = ex.message) === null || _a === void 0 ? void 0 : _a.includes('not exist')) {
                return;
            }
            throw (0, utils_1.MemphisError)(ex);
        }
    }
    _getConsumerKey() {
        const internalStationName = this.stationName.replace(/\./g, '#').toLowerCase();
        return `${internalStationName}_${this.realName}`;
    }
    _getConsumerStation() {
        return this.stationName;
    }
}
exports.Consumer = Consumer;
