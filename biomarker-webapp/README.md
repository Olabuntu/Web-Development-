# Common Biomarker Extractor - Web Application

A modern web application for extracting common biomarkers from multiple Hapmap files using accession numbers and converting files between different formats (Hapmap, VCF, and Dosage).

## Features

- ✅ **Home Page**: Displays application information and statistics
- ✅ **Search Functionality**: Multi-stage workflow to find common biomarkers
- ✅ **File Converter**: Convert files between 5 different formats
- ✅ **Database Management**: Upload and manage Hapmap files in MySQL database
- ✅ **All Original Functions Preserved**: All 15 functions from the original Streamlit app

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Responsive design with mobile support
- Modern UI with animations

### Backend
- Python 3.8+
- Flask 2.3+
- MySQL database
- RESTful API

### External Tools
- TASSEL 5 (for Hapmap/VCF conversions)
- PLINK (for dosage file generation)

## Installation

### Prerequisites
- Python 3.8 or higher
- MySQL 8.0 or higher
- TASSEL 5 installed
- PLINK installed

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Set up database:
```sql
CREATE DATABASE IF NOT EXISTS allfiles;
USE allfiles;

CREATE TABLE IF NOT EXISTS files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    FileName VARCHAR(255) NOT NULL,
    File LONGBLOB NOT NULL,
    MetaData TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

6. Run the application:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

The frontend is served by the Flask application. Simply access:
```
http://localhost:5000
```

## Configuration

Edit `backend/.env` file with your settings:

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=allfiles

# External Tools
TASSEL_PATH=/Applications/'TASSEL 5'/run_pipeline.pl
PLINK_PATH=plink

# Authentication
ADMIN_USERNAME=Dr Agre
ADMIN_PASSWORD=1234
```

## Project Structure

```
biomarker-webapp/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── config.py              # Configuration
│   ├── requirements.txt       # Python dependencies
│   ├── database/              # Database modules
│   ├── services/              # Business logic
│   ├── utils/                 # Utility functions
│   └── routes/                # API routes
├── frontend/
│   ├── index.html             # Main HTML file
│   ├── css/                   # Stylesheets
│   ├── js/                    # JavaScript modules
│   └── images/                # Image assets
│       ├── slides/            # Slideshow images (slide1-3.jpeg)
│       └── assets/            # Other images (image.png, image2.png)
├── uploads/                   # Temporary uploads
├── hapmap/                    # Hapmap output
├── Vcf/                       # VCF output
├── Dosage/                    # Dosage output
└── output/                    # Converter output
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Files
- `GET /api/files/all` - Get all files
- `POST /api/files/upload` - Upload file
- `POST /api/files/cleanup` - Clean temporary files

### Search
- `POST /api/search/check` - Check accessions
- `POST /api/search/biomarkers` - Find common biomarkers
- `POST /api/search/prepare-download` - Prepare download
- `GET /api/search/download/<format>` - Download file

### Converter
- `POST /api/convert` - Convert file
- `GET /api/convert/list` - List converted files
- `GET /api/convert/download/<filename>` - Download converted file

### Statistics
- `GET /api/statistics/accessions` - Get accession count
- `GET /api/statistics/files` - Get file statistics

## Usage

### Search for Common Biomarkers

1. Navigate to **Search** page
2. Enter accession numbers (space-separated) or upload a .txt file
3. Click "Check Files" to find matching files
4. Click "Check for Common Biomarkers" to find common rs# values
5. Select output format (Hapmap, VCF, or Dosage)
6. Download files (combined or separate)

### Convert Files

1. Navigate to **File Converter** page
2. Select conversion type
3. Upload file
4. Click "Convert"
5. Download converted file

### Upload to Database

1. Navigate to **Database** page
2. Login with credentials
3. Upload .hmp.txt file
4. Enter metadata
5. Click "Upload"

## Development

### Running in Development Mode

```bash
cd backend
python app.py
```

### Production Deployment

Use Gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Notes

- All functions from the original Streamlit application are preserved
- MySQL database integration is maintained
- External tools (TASSEL, PLINK) must be installed and accessible
- **Image Structure**:
  - Slideshow images: `frontend/images/slides/` (slide1.jpeg, slide2.jpeg, slide3.jpeg)
  - Other images: `frontend/images/assets/` (image.png, image2.png)

## License

This project is developed for research purposes.

## Authors

- **Dr. Agre Paterne** - CGIAR scientist and bioinformatics expert (supervisor)
- **Olabuntu Babatunde Afeez** - Student and bioinformatician (developer)

