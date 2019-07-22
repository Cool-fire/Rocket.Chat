import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { HTTP } from 'meteor/http';

import { Messages } from '../../app/models';
import Rooms from '../../app/models/server/models/Rooms';
import Users from '../../app/models/server/models/Users';
import { canAccessRoom } from '../../app/authorization';


Meteor.methods({
	sendMessageToBot(type, payload) {
		check(type, String);
		check(payload, Object);

		const { msgId, botId, roomId } = payload;

		check(msgId, String);
		check(botId, String);
		check(roomId, String);

		const userId = Meteor.userId();

		const user = Users.findOneById(userId, { fields: { _id: 1, type: 1, roles: 1, username: 1 } });
		if (!user) {
			throw new Meteor.Error(`No user found with the id of "${ userId }".`);
		}

		const room = Rooms.findOneById(roomId, { fields: { _id: 1, name: 1 } });
		if (!room) {
			throw new Meteor.Error(`No Room found with the id of "${ roomId }".`);
		}

		if (!canAccessRoom(room, user)) {
			throw new Meteor.Error(`User has no access to Room with id of ${ roomId }`);
		}

		if (!payload.actions) {
			throw new Meteor.Error('The required "actions" param is missing.');
		}

		const msg = Messages.findOneById(msgId);
		if (!msg) {
			throw new Meteor.Error(`No message found with the id of "${ msgId }".`);
		}

		const bot = Users.findOneById(botId, { fields: { services: 0 } });
		if (!bot || !bot.roles.includes('bot')) {
			throw new Meteor.Error(`No bot found with the id of "${ botId }".`);
		}

		if (!bot.customFields || !bot.customFields.webHookUrl) {
			throw new Meteor.Error(`No webhookUrl is set for this bot with id "${ botId }".`);
		}

		const interactivePayload = {
			type,
			user,
			room,
			originalMessage: msg,
			actions: payload.actions,
		};

		const { webHookUrl } = bot.customFields;
		try {
			HTTP.call('POST', webHookUrl, {
				data: interactivePayload,
			});
			return interactivePayload;
		} catch (e) {
			if (e.code === 'ECONNREFUSED') {
				throw new Meteor.Error(`Connection refused by the webHookUrl ${ webHookUrl }`);
			}
			return false;
		}
	},
});
