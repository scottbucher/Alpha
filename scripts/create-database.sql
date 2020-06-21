-- phpMyAdmin SQL Dump
-- version 4.9.5
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 21, 2020 at 03:46 AM
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
-- Database: `birthdaybotdev`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_AddMessage` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Message` VARCHAR(2000))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

INSERT INTO `messages` (
 	GuildId,
    Message
   ) VALUES (
     @GuildId,
     IN_Message
   );
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_AddOrUpdate` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_BirthdayChannelDiscordId` VARCHAR(20), IN `IN_BirthdayRoleDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

IF @GuildId IS NULL THEN
	INSERT INTO `guild` (
		GuildDiscordId,
		BirthdayChannelDiscordId,
		BirthdayRoleDiscordId
	) VALUES (
		IN_GuildDiscordId,
		IN_BirthdayChannelDiscordId,
		IN_BirthdayRoleDiscordId
	);
ELSE
	UPDATE `guild`
	SET
		GuildDiscordId = IN_GuildDiscordId,
		BirthdayChannelDiscordId = IN_BirthdayChannelDiscordId,
		BirthdayRoleDiscordId = IN_BirthdayRoleDiscordId
	WHERE GuildId = @GuildId;
END IF;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_Get` (IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SELECT *
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_GetTotalMessages` (IN `IN_GuildDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

SELECT COUNT(Message) AS Total FROM messages WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_RemoveMessage` (IN `IN_GuildDiscordId` INT(20), IN `IN_Spot` INT)  NO SQL
BEGIN

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_SetupMessage` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_MessageTime` TINYINT, IN `IN_MentionSetting` VARCHAR(20), IN `IN_UseEmbed` TINYINT(1))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET
	GuildDiscordId = IN_GuildDiscordId,
	MessageTime = IN_MessageTime,
    MentionSetting = IN_MentionSetting,
    UseEmbed = IN_UseEmbed
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateBirthdayChannel` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_BirthdayChannelDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET BirthdayChannelDiscordId = IN_BirthdayChannelDiscordId
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateBirthdayRole` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_BirthdayRoleDiscordId` VARCHAR(20))  NO SQL
BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET BirthdayRoleDiscordId = IN_BirthdayRoleDiscordId
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateMentionSetting` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_MentionSetting` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET MentionSetting = IN_MentionSetting
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateMessageTime` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Time` TINYINT)  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET MessageTime = IN_Time
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateTrustedRole` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_TrustedRoleDiscordId` VARCHAR(20))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET TrustedRoleDiscordId = IN_TrustedRoleDiscordId
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `Guild_UpdateUseEmbed` (IN `IN_GuildDiscordId` VARCHAR(20), IN `IN_Value` TINYINT(1))  BEGIN

SET @GuildId = NULL;

SELECT GuildId
INTO @GuildId
FROM `guild`
WHERE GuildDiscordId = IN_GuildDiscordId;

UPDATE `guild`
SET UseEmbed = IN_Value
WHERE GuildId = @GuildId;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_AddOrUpdate` (IN `IN_UserDiscordId` VARCHAR(20), IN `IN_Birthday` DATE, IN `IN_Timezone` VARCHAR(100), IN `IN_ChangesLeft` TINYINT)  BEGIN

SET @UserId = NULL;

SELECT UserId
INTO @UserId
FROM `user`
WHERE UserDiscordId = IN_UserDiscordId;

IF @UserId IS NULL THEN
	INSERT INTO `user` (
		UserDiscordId,
		Birthday,
		TimeZone,
        ChangesLeft
	) VALUES (
		IN_UserDiscordId,
		IN_Birthday,
		IN_Timezone,
        IN_ChangesLeft
	);
ELSE
	UPDATE `user`
	SET
		UserDiscordId = IN_UserDiscordId,
		Birthday = IN_Birthday,
		TimeZone = IN_TimeZone,
        ChangesLeft = IN_ChangesLeft
	WHERE UserId = @UserId;
END IF;

END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `User_Get` (IN `IN_UserDiscordId` VARCHAR(20))  BEGIN

SELECT *
FROM `user`
WHERE UserDiscordId = IN_UserDiscordId;

END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `guild`
--

CREATE TABLE `guild` (
  `GuildId` int(11) NOT NULL,
  `GuildDiscordId` varchar(20) NOT NULL,
  `BirthdayChannelDiscordId` varchar(20) NOT NULL DEFAULT '0',
  `BirthdayRoleDiscordId` varchar(20) DEFAULT '0',
  `TrustedRoleDiscordId` varchar(20) DEFAULT '0',
  `MentionSetting` varchar(20) DEFAULT '0',
  `MessageTime` tinyint(1) NOT NULL DEFAULT '0',
  `TrustedPreventsRole` tinyint(1) NOT NULL DEFAULT '1',
  `TrustedPreventsMessage` tinyint(1) NOT NULL DEFAULT '1',
  `UseEmbed` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `MessageId` int(11) NOT NULL,
  `GuildId` int(11) DEFAULT NULL,
  `Message` varchar(2000) CHARACTER SET utf8mb4 NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `UserId` int(11) NOT NULL,
  `UserDiscordId` varchar(20) NOT NULL,
  `Birthday` date DEFAULT NULL,
  `TimeZone` varchar(100) CHARACTER SET utf32 DEFAULT NULL,
  `ChangesLeft` tinyint(4) DEFAULT '5'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `guild`
--
ALTER TABLE `guild`
  ADD PRIMARY KEY (`GuildId`),
  ADD UNIQUE KEY `BirthdayChannel` (`BirthdayChannelDiscordId`),
  ADD UNIQUE KEY `DiscordId` (`GuildDiscordId`),
  ADD UNIQUE KEY `BirthdayRole` (`BirthdayRoleDiscordId`),
  ADD UNIQUE KEY `TrustedRole` (`TrustedRoleDiscordId`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`MessageId`),
  ADD KEY `FK_Messages_GuildId` (`GuildId`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`UserId`),
  ADD UNIQUE KEY `UserDiscordId` (`UserDiscordId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `guild`
--
ALTER TABLE `guild`
  MODIFY `GuildId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `MessageId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `UserId` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
