const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const chatSchema = new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    senderRead: {
        type: Boolean,
        default: false
    },
    reciever: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    recieverRead: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now
    },
    chats: [{
        senderName: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        senderMessage: {
            type: String
        },
        senderRead: {
            type: Boolean,
            default: false
        },
        recieverName: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        recieverMessage: {
            type: String
        },
        recieverRead: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: Date.now
        }
    }]
});

module.exports = mongoose.model('Chat',chatSchema);