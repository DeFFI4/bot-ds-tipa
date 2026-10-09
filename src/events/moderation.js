const { Events, AuditLogEvent } = require('discord.js');
const { isBanLogged, logBanAudit } = require('../utils/logger');

module.exports = [
  {
    name: Events.GuildBanAdd,
    /**
     * @param {import('discord.js').GuildBan} ban
     */
    async execute(ban) {
      if (!ban.guild) return;

      // Дедупликация: если бан был вызван через слэш-команду бота /ban
      if (isBanLogged(ban.user.id)) {
        return;
      }

      let executor = null;
      let reason = ban.reason || null;

      try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberBanAdd
        });
        const banLog = fetchedLogs.entries.first();
        if (banLog && banLog.target?.id === ban.user.id) {
          executor = banLog.executor;
          if (banLog.reason) reason = banLog.reason;
        }
      } catch (err) {
        // Ошибка или отсутствие прав ViewAuditLog
      }

      try {
        await logBanAudit(ban.guild, {
          target: ban.user,
          executor,
          reason: reason || 'Причина не указана',
          action: 'ban'
        });
      } catch (err) {
        console.error('[Events: GuildBanAdd] Ошибка при логировании бана:', err);
      }
    }
  },
  {
    name: Events.GuildBanRemove,
    /**
     * @param {import('discord.js').GuildBan} ban
     */
    async execute(ban) {
      if (!ban.guild) return;

      let executor = null;
      let reason = null;

      try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberBanRemove
        });
        const unbanLog = fetchedLogs.entries.first();
        if (unbanLog && unbanLog.target?.id === ban.user.id) {
          executor = unbanLog.executor;
          if (unbanLog.reason) reason = unbanLog.reason;
        }
      } catch (err) {
        // Ошибка или отсутствие прав ViewAuditLog
      }

      try {
        await logBanAudit(ban.guild, {
          target: ban.user,
          executor,
          reason: reason || 'Снятие бана модератором',
          action: 'unban'
        });
      } catch (err) {
        console.error('[Events: GuildBanRemove] Ошибка при логировании разбана:', err);
      }
    }
  }
];
