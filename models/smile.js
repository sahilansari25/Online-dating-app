const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const smileSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    senderSent: {
        type: Boolean,
        default: false
    },
    reciever: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    recieverRecieved: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Smile',smileSchema);