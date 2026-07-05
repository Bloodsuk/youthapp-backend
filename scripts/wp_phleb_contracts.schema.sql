-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jun 29, 2026 at 04:50 PM
-- Server version: 8.0.36-28
-- PHP Version: 8.1.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `youth-revisited`
--

-- --------------------------------------------------------

--
-- Table structure for table `wp_phleb_contracts`
--

CREATE TABLE `wp_phleb_contracts` (
  `id` bigint NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `contractor_name` text COLLATE utf8mb4_unicode_520_ci,
  `address` text COLLATE utf8mb4_unicode_520_ci,
  `phone` text COLLATE utf8mb4_unicode_520_ci,
  `email` text COLLATE utf8mb4_unicode_520_ci,
  `full_name` text COLLATE utf8mb4_unicode_520_ci,
  `dob` text COLLATE utf8mb4_unicode_520_ci,
  `home_address` text COLLATE utf8mb4_unicode_520_ci,
  `mobile_number` text COLLATE utf8mb4_unicode_520_ci,
  `personal_email` text COLLATE utf8mb4_unicode_520_ci,
  `emergency_contact` text COLLATE utf8mb4_unicode_520_ci,
  `areas_covered` text COLLATE utf8mb4_unicode_520_ci,
  `travel_radius` text COLLATE utf8mb4_unicode_520_ci,
  `available_days` text COLLATE utf8mb4_unicode_520_ci,
  `weekend_availability` text COLLATE utf8mb4_unicode_520_ci,
  `clinic_mobile` text COLLATE utf8mb4_unicode_520_ci,
  `own_vehicle` text COLLATE utf8mb4_unicode_520_ci,
  `account_name` text COLLATE utf8mb4_unicode_520_ci,
  `sort_code` text COLLATE utf8mb4_unicode_520_ci,
  `account_number` text COLLATE utf8mb4_unicode_520_ci,
  `payment_frequency` text COLLATE utf8mb4_unicode_520_ci,
  `cv_file` text COLLATE utf8mb4_unicode_520_ci,
  `phlebotomy_qualifications` text COLLATE utf8mb4_unicode_520_ci,
  `relevant_certificates` text COLLATE utf8mb4_unicode_520_ci,
  `cpd_training` text COLLATE utf8mb4_unicode_520_ci,
  `clinical_competencies` text COLLATE utf8mb4_unicode_520_ci,
  `hep_b_proof` text COLLATE utf8mb4_unicode_520_ci,
  `occupational_health_records` text COLLATE utf8mb4_unicode_520_ci,
  `dbs_adults` text COLLATE utf8mb4_unicode_520_ci,
  `dbs_children` text COLLATE utf8mb4_unicode_520_ci,
  `right_to_work` text COLLATE utf8mb4_unicode_520_ci,
  `utr_file` text COLLATE utf8mb4_unicode_520_ci,
  `contractor_signature` text COLLATE utf8mb4_unicode_520_ci,
  `contractor_signature_date` text COLLATE utf8mb4_unicode_520_ci,
  `youth_signature` text COLLATE utf8mb4_unicode_520_ci,
  `youth_signature_date` text COLLATE utf8mb4_unicode_520_ci,
  `declaration_signature` text COLLATE utf8mb4_unicode_520_ci,
  `declaration_name` text COLLATE utf8mb4_unicode_520_ci,
  `declaration_date` text COLLATE utf8mb4_unicode_520_ci,
  `bank_signature` text COLLATE utf8mb4_unicode_520_ci,
  `bank_signature_date` text COLLATE utf8mb4_unicode_520_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `wp_phleb_contracts`
--
ALTER TABLE `wp_phleb_contracts`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `wp_phleb_contracts`
--
ALTER TABLE `wp_phleb_contracts`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
