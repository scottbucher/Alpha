-- phpMyAdmin SQL Dump
-- version 4.9.5
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 08, 2020 at 05:18 PM
-- Server version: 5.7.24
-- PHP Version: 7.4.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `alphadev`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_Add` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Prefix` VARCHAR(100))  BEGIN

INSERT INTO guild(GuildDiscordId, Prefix)
VALUES(IN_GuildDiscordId, IN_Prefix);

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_AddReward` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_RoleDiscordId` VARCHAR(20), IN `IN_Level` SMALLINT)  BEGIN

SET @GuildId = NULL;
SET @RoleDiscordId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT RoleDiscordId
INTO @RoleDiscordId
FROM `reward`
WHERE RoleDiscordId = IN_RoleDiscordId AND Level = IN_Level;

#This is done the complicated way to prevent skipping RewardIds
IF @RoleDiscordId IS NULL THEN 
	INSERT INTO reward (GuildId, RoleDiscordId, Level)
	VALUES (@GuildId, IN_RoleDiscordId, IN_Level);
END IF;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_AddRoleCall` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_RoleDiscordId` VARCHAR(20), IN `IN_Emote` VARCHAR(20) CHARSET utf8mb4, IN `IN_Category` VARCHAR(30))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

INSERT INTO `rolecall` (GuildId, RoleDiscordId, Emote, Category)
VALUES (@GuildId, IN_RoleDiscordId, IN_Emote, IN_Category);

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_ClearLevelRewards` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Level` SMALLINT)  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

DELETE FROM `reward`
WHERE `GuildId` = @GuildId AND `Level` = IN_Level;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_Get` (IN `IN_DiscordId` VARCHAR(20))  BEGIN

SELECT *
FROM Guild
WHERE GuildDiscordId = IN_DiscordId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_GetAll` (IN `IN_DiscordIds` MEDIUMTEXT)  BEGIN

SELECT DiscordId
FROM guild
WHERE FIND_IN_SET(GuildDiscordId, IN_DiscordIds) > 0;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_GetLevelRewards` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Level` SMALLINT)  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM guild
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT RoleDiscordId
FROM `reward`
WHERE GuildId = @GuildId AND Level = IN_Level;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_GetRoleCalls` (IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT *
FROM `rolecall`
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_GetSome` (IN `IN_DiscordIds` MEDIUMTEXT)  BEGIN

SELECT *
FROM Guild
WHERE FIND_IN_SET(GuildDiscordId, IN_DiscordIds) > 0;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_RemoveRoleCall` (IN `IN_RoleDiscordId` VARCHAR(20))  BEGIN

DELETE FROM `rolecall`
WHERE `RoleDiscordId` = IN_RoleDiscordId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_Sync` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_UserDiscordIds` MEDIUMTEXT)  NO SQL
BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM guild
WHERE GuildDiscordId = IN_GuildDiscordId;

IF @GuildId IS NULL THEN
	INSERT INTO guild (GuildDiscordId) VALUES (IN_GuildDiscordId);
    
    SELECT GuildId
	INTO @GuildId
	FROM guild
	WHERE GuildDiscordId = IN_GuildDiscordId;
END IF;

DROP TEMPORARY TABLE IF EXISTS temp;
CREATE TEMPORARY TABLE temp( val VARCHAR(20) );
SET @SQL = CONCAT("INSERT INTO temp (val) values ('", REPLACE(IN_UserDiscordIds, ",", "'),('"),"');");

PREPARE stmt1 FROM @sql;
EXECUTE stmt1;

INSERT INTO `user` (UserDiscordId)
SELECT val
FROM temp
LEFT JOIN user
    ON user.UserDiscordId = val
WHERE user.UserDiscordId IS NULL;
DROP TEMPORARY TABLE IF EXISTS temp;

INSERT INTO `guilduser` (UserId, GuildId)
SELECT
    user.UserId,
    @GuildId AS GuildId
FROM `user`
LEFT JOIN guilduser
    ON guilduser.GuildId = @GuildId
    AND guilduser.UserId = user.UserId
WHERE guilduser.GuildUserId IS NULL;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateLevelingChannel` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_LevelingChannelId` VARCHAR(20))  BEGIN

UPDATE `guild`
SET LevelingChannelId = IN_LevelingChannelId
WHERE GuildDiscordId = IN_GuildDiscordId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateWelcomeChannel` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_WelcomeChannelId` VARCHAR(20))  BEGIN

UPDATE `guild`
SET WelcomeChannelId = IN_WelcomeChannelId
WHERE GuildDiscordId = IN_GuildDiscordId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Add` (IN `IN_UserDiscordId` VARCHAR(20), IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM guild
WHERE GuildDiscordId = IN_GuildDiscordId;

INSERT INTO `user`(UserDiscordId)
VALUES(IN_UserDiscordId);

INSERT INTO guilduser(GuildId, UserId)
VALUES (@GuildId, LAST_INSERT_ID());

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Get` (IN `IN_UserDiscordId` VARCHAR(20), IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;
SET @UserId = NULL;

SELECT GuildId
INTO @GuildId
FROM guild
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT UserId
INTO @UserId
FROM `user`
WHERE UserDiscordId = IN_UserDiscordId;

SELECT XpAmount, LastUpdated
FROM `guilduser`
WHERE GuildId = @GuildId AND UserId = @UserId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_GetAll` (IN `IN_UserDiscordIds` MEDIUMTEXT, IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM guild
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT UserDiscordId
FROM users
WHERE FIND_IN_SET(UserDiscordId, IN_DiscordIds) > 0 AND GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Sync` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_UserDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;
SET @UserId = NULL;
SET @GuildUserId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT UserId
INTO @UserId
FROM `user`
WHERE UserDiscordId = IN_UserDiscordId;

IF @UserId IS NULL THEN
	INSERT INTO user (UserDiscordId) VALUES (IN_UserDiscordId);
    
    SELECT UserId
	INTO @UserId
	FROM `user`
	WHERE UserDiscordId = IN_UserDiscordId;
END IF;

SELECT GuildUserId
INTO @GuildUserId
FROM `guilduser`
WHERE UserId = @UserId AND GuildId = @GuildId;

IF @GuildUserId IS NULL THEN
	INSERT INTO `guilduser` (UserId, GuildId)
	VALUES (@UserId, @GuildId);
END IF;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Update` (IN `IN_UserDiscordId` VARCHAR(20), IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Xp` INT)  BEGIN

SET @GuildId = NULL;
SET @UserId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT UserId
INTO @UserId
FROM `user`
WHERE UserDiscordId = IN_UserDiscordId;

UPDATE guilduser
SET XpAmount = IN_Xp, LastUpdated = CURRENT_TIMESTAMP
WHERE UserId = @UserId AND GuildId = @GuildId;

END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `guild`
--

CREATE TABLE `guild` (
  `GuildId` int(11) NOT NULL,
  `GuildDiscordId` varchar(20) NOT NULL,
  `Prefix` varchar(100) NOT NULL DEFAULT '!',
  `LevelingChannelId` varchar(20) DEFAULT '0',
  `WelcomeChannelId` varchar(20) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `guilduser`
--

CREATE TABLE `guilduser` (
  `GuildUserId` int(11) NOT NULL,
  `UserId` int(11) NOT NULL,
  `GuildId` int(11) NOT NULL,
  `XpAmount` int(11) DEFAULT '0',
  `LastUpdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `reward`
--

CREATE TABLE `reward` (
  `RewardId` int(11) NOT NULL,
  `GuildId` int(11) NOT NULL,
  `RoleDiscordId` varchar(20) NOT NULL,
  `Level` smallint(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `rolecall`
--

CREATE TABLE `rolecall` (
  `RoleCallId` int(11) NOT NULL,
  `GuildId` int(11) NOT NULL,
  `RoleDiscordId` varchar(20) NOT NULL,
  `Emote` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
  `Category` varchar(30) CHARACTER SET utf8mb4 DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `UserId` int(11) NOT NULL,
  `UserDiscordId` varchar(18) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `guild`
--
ALTER TABLE `guild`
  ADD PRIMARY KEY (`GuildId`),
  ADD UNIQUE KEY `UQ_GuildDiscordId` (`GuildDiscordId`) USING BTREE;

--
-- Indexes for table `guilduser`
--
ALTER TABLE `guilduser`
  ADD PRIMARY KEY (`GuildUserId`),
  ADD UNIQUE KEY `UQ_GuildId_UserId` (`UserId`,`GuildId`) USING BTREE,
  ADD KEY `FK_GuildUser_GuildId` (`GuildId`) USING BTREE,
  ADD KEY `FK_GuildUser_UserId` (`UserId`) USING BTREE;

--
-- Indexes for table `reward`
--
ALTER TABLE `reward`
  ADD PRIMARY KEY (`RewardId`),
  ADD KEY `FK_Reward_GuildId` (`GuildId`) USING BTREE;

--
-- Indexes for table `rolecall`
--
ALTER TABLE `rolecall`
  ADD PRIMARY KEY (`RoleCallId`),
  ADD UNIQUE KEY `UQ_RoleDiscordId` (`RoleDiscordId`) USING BTREE,
  ADD KEY `FK_RoleCall_GuildId` (`GuildId`) USING BTREE;

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`UserId`),
  ADD UNIQUE KEY `UQ_UserDiscordId` (`UserDiscordId`) USING BTREE;

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `guild`
--
ALTER TABLE `guild`
  MODIFY `GuildId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `guilduser`
--
ALTER TABLE `guilduser`
  MODIFY `GuildUserId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reward`
--
ALTER TABLE `reward`
  MODIFY `RewardId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rolecall`
--
ALTER TABLE `rolecall`
  MODIFY `RoleCallId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `UserId` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `guilduser`
--
ALTER TABLE `guilduser`
  ADD CONSTRAINT `guilduser_ibfk_1` FOREIGN KEY (`GuildId`) REFERENCES `guild` (`GuildId`),
  ADD CONSTRAINT `guilduser_ibfk_2` FOREIGN KEY (`UserId`) REFERENCES `user` (`UserId`);

--
-- Constraints for table `reward`
--
ALTER TABLE `reward`
  ADD CONSTRAINT `reward_ibfk_1` FOREIGN KEY (`GuildId`) REFERENCES `guild` (`GuildId`);

--
-- Constraints for table `rolecall`
--
ALTER TABLE `rolecall`
  ADD CONSTRAINT `rolecall_ibfk_1` FOREIGN KEY (`GuildId`) REFERENCES `guild` (`GuildId`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
