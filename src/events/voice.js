const { Events } = require('discord.js');
const { logVoiceUpdate } = require('../utils/logger');

module.exports = [
  {
    name: Events.VoiceStateUpdate,
    /**
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     */
    async execute(oldState, newState) {
      const member = newState.member || oldState.member;
      if (!member) return;

      // Игнорируем ботов в голосовых каналах
      if (member.user?.bot) return;

      const guild = newState.guild || oldState.guild;
      if (!guild) return;

      // 1. Вход в голосовой канал
      if (!oldState.channelId && newState.channelId) {
        try {
          await logVoiceUpdate(guild, {
            member,
            action: 'join',
            oldChannel: null,
            newChannel: newState.channel
          });
        } catch (err) {
          console.error('[Events: VoiceStateUpdate:join] Ошибка:', err);
        }
        return;
      }

      // 2. Отключение от голосового канала
      if (oldState.channelId && !newState.channelId) {
        try {
          await logVoiceUpdate(guild, {
            member,
            action: 'leave',
            oldChannel: oldState.channel,
            newChannel: null
          });
        } catch (err) {
          console.error('[Events: VoiceStateUpdate:leave] Ошибка:', err);
        }
        return;
      }

      // 3. Переход из одного канала в другой
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        try {
          await logVoiceUpdate(guild, {
            member,
            action: 'move',
            oldChannel: oldState.channel,
            newChannel: newState.channel
          });
        } catch (err) {
          console.error('[Events: VoiceStateUpdate:move] Ошибка:', err);
        }
        return;
      }
    }
  }
];
