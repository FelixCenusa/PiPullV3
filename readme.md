<p align="center">
  <img src="https://img.icons8.com/?size=512&id=55494&format=png" width="20%" alt="PIPULLV3-logo">
</p>

<h1 align="center">PIPULLV3</h1>

<p align="center">
  <em><code>❯ Felix Cenusa</code></em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/FelixCenusa/PiPullV3?style=flat&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
  <img src="https://img.shields.io/github/last-commit/FelixCenusa/PiPullV3?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
  <img src="https://img.shields.io/github/languages/top/FelixCenusa/PiPullV3?style=flat&color=0080ff" alt="repo-top-language">
  <img src="https://img.shields.io/github/languages/count/FelixCenusa/PiPullV3?style=flat&color=0080ff" alt="repo-language-count">
</p>

<p align="center">
  <em>Built with the tools and technologies:</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=flat&logo=Axios&logoColor=white" alt="Axios">
  <img src="https://img.shields.io/badge/MySQL-4479A1.svg?style=flat&logo=MySQL&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/Passport-34E27A.svg?style=flat&logo=Passport&logoColor=white" alt="Passport">
  <img src="https://img.shields.io/badge/Lodash-3492FF.svg?style=flat&logo=Lodash&logoColor=white" alt="Lodash">
  <img src="https://img.shields.io/badge/Express-000000.svg?style=flat&logo=Express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white" alt="JSON">
  <img src="https://img.shields.io/badge/BcryptJS-023E8A.svg?style=flat&logo=lock&logoColor=white" alt="BcryptJS">
  <img src="https://img.shields.io/badge/Multer-9ACD32.svg?style=flat&logo=storage&logoColor=black" alt="Multer">
  <img src="https://img.shields.io/badge/Nodemailer-2C3E50.svg?style=flat&logo=mail&logoColor=white" alt="Nodemailer">
  <img src="https://img.shields.io/badge/Dotenv-58D68D.svg?style=flat&logo=dotenv&logoColor=white" alt="Dotenv">
  <img src="https://img.shields.io/badge/Node--Cron-8A2BE2.svg?style=flat&logo=clock&logoColor=white" alt="Node-Cron">
  <img src="https://img.shields.io/badge/Archiver-800080.svg?style=flat&logo=archive&logoColor=white" alt="Archiver">
  <img src="https://img.shields.io/badge/PDFKit-FF6347.svg?style=flat&logo=pdf&logoColor=white" alt="PDFKit">
  <img src="https://img.shields.io/badge/Sanitize--HTML-FF1493.svg?style=flat&logo=html5&logoColor=white" alt="Sanitize-HTML">
</p>


## Overview

**PIPULLV3** is a web application developed by **Felix Cenusa** that enables users to create, share, and manage digital labels with advanced security and privacy features. The platform offers seamless integration with Gmail, robust password security, admin controls, uploads and downloads, providing a user-friendly experience for both end-users and administrators.

## Features

## **Web-App Features**

### **Account:**

- Accounts can be created with a strong password and email confirmation or via direct Google authentication.
- Accounts can be edited, deactivated, or deleted.
- User information, including passwords, is securely hashed and salted for enhanced security.
- Accounts will be automatically deactivated after 3 months of inactivity, with several reminder emails sent before deactivation.

### **Boxes:**

- Boxes can be created, edited, or deleted.
- Contents of any file type can be added or removed from boxes.
- Boxes can be shared with other users, made public or private.
- Private boxes can be secured with a 6-digit code when shared.
- Shared boxes are sent directly to the recipient’s email for easy access.

### **Admin Features:**

- Admins have access to all user data and storage usage information.
- Admins can send marketing emails to users.
- Admins can activate or deactivate user accounts as needed.

### **Personal Touches:**

- Integrated CAPTCHA for spam prevention during registration and login.
- Added a statistics display, including total lines of code, on the homepage along with a leaderboard.
- Implemented a Kanban board for task management and feature suggestions.
- Added an architecture viewer for visualizing the project structure.

### **Security:**

#### **Input Validation & Sanitization:**

- **Sanitizing User Inputs:** All user inputs are cleaned up by removing potentially harmful HTML or JavaScript, preventing Cross-Site Scripting (XSS) attacks.
- **HTML Encoding:** User-generated content is encoded so that special characters cannot be interpreted as executable code.
- **Regex Validation:** Regular expressions are used to ensure fields like usernames, emails, and passwords meet specific security standards, reducing the risk of invalid or malicious data being submitted.

#### **Password Security:**

- **Hashing and Salting:** Passwords are hashed and salted using bcrypt, ensuring they are never stored as plain text. This makes it difficult for attackers to retrieve passwords even if they gain access to the database.
- **Password Strength Requirements:** Users must create strong passwords that include a mix of uppercase and lowercase letters, numbers, and special characters.

#### **Session Security:**

- **Secure Session Management:** User sessions are securely tied to each user, and session cookies are configured to prevent cross-site scripting attacks.
- **Session Expiration:** Sessions automatically expire after a period of inactivity, preventing unauthorized access if a user forgets to log out.

#### **IP-Based View Counting:**

- **Hashed IP Addresses:** IP addresses are hashed before storage, maintaining user privacy while allowing the system to differentiate between unique and total page views.
- **Unique View Counting:** By using hashed IPs, I can track unique visitors to provide accurate statistics without compromising user anonymity.
- **Rate Limiting:** Will implement IP based rate limiting later, but for now captcha is very good at stopping bots.

#### **File Upload Security:**

- **File Size Limits:** Limits are placed on file sizes to prevent oversized uploads that could harm system performance or be used for denial-of-service attacks.
- **File Path and Name Security:** Uploaded files are renamed and stored securely, with path and filename sanitization ensuring no malicious paths or characters compromise the system.
- **MIME Type Checking:** File uploads are validated by checking MIME types to ensure that the content matches the declared file extension, protecting against malicious content disguised as safe file types.

#### **SQL Injection Prevention:**

- **Parameterized Queries:** All database queries use parameterized statements, preventing SQL injection attacks by ensuring user input is never directly inserted into SQL commands.

#### **Ongoing Security Monitoring:**

- I continuously monitor the platform for vulnerabilities and apply updates as necessary. If any security issue is noticed, I am quick to address it to keep the platform secure.
---

## **Self-Hosted Features**

- Currently, a single Raspberry Pi hosts and stores all the data for the application.
- The Pi automatically pulls the latest updates from this GitHub repository and runs the application using PM2.
- I use cron jobs to handle repository pulls and to update Cloudflare with the Pi’s new IP address if it changes, ensuring continuous tunneling to keep the website public.
- Tunneling data through Cloudflare ensures the site is accessible publicly, and I maintain secure remote access to the Pi using SSH.
- HTTPS SSL key.
- Automatically boots and runs the server again if it crashes or wifi goes down.

### **Future Expansion:**

- Once the new components arrive, I plan to expand to a network of 2 Raspberry Pis running the same data.
- These Pis will synchronize using a custom program secured with private and public keys.
- Each location will be configured for data redundancy, ensuring automatic data replication in case one server goes down, providing high availability and fault tolerance.
## Built With

- **JavaScript**
- **MySQL**
- **EJS**
- A loooot of packages

## Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/FelixCenusa/PiPullV3.git
   ```
   
1. **Install Dependencies**
    ```bash
    cd PiPullV3
    npm install
    ```
    
1. **Set Up Database**
    - Create a MySQL database.
    - Run the provided SQL scripts to set up the necessary tables.
    
1. **Configure Environment Variables**
    - Create a `.env` file.
    - Add your database credentials, API keys, and other configuration settings.
    
1. **Run the Application**
    ```bash
    node index.js
    ```


## Usage

- **Registration/Login:** Users can sign up using email/password or their Gmail accounts.
- **Creating Labels:** After logging in, users can create new digital labels with customized content.
- **Sharing Labels:** Labels can be shared via email or within the platform.
- **Privacy Controls:** Users can set labels to private and manage PIN protection.
- **Admin Access:** Admin users can log in to access the admin dashboard for user management.

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the Repository** (if you haven’t already) by going to the main repository on GitHub and clicking the “Fork” button at the top-right of the page.

2. **Create a Feature Branch**
    ```bash
    git checkout -b feature/YourFeature
    ```
    
3. **Commit Your Changes**
    
    ```bash
    git commit -m 'Add Your Feature'
    ```
    
4. **Push to the Branch**

    ```bash
    git push origin feature/YourFeature
    ```
    

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

- **Email:** felixcenusa@gmail.com
- **LinkedIn:** [Felix Cenusa](https://www.linkedin.com/in/felixcenusa)
- **GitHub:** [FelixCenusa](https://github.com/FelixCenusa)

---

<p align="center"> <img src="https://img.icons8.com/?size=512&id=55494&format=png" width="5%" alt="PIPULLV3-logo"> </p> ```