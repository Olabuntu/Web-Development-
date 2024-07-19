from flask import Flask, render_template, request
from database import all_data, get_data, insert_data
from werkzeug.utils import secure_filename
from pathlib import Path


app = Flask(__name__)


allowed_extensions = {'pdf', 'docx', 'doc'}
app.config['UPLOADS'] = 'uploads'

def allowed_file(filename):
    return filename.split('.')[-1].lower() in allowed_extensions



def handling_file(file, name, email):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        cv = file.read()
        file.save(Path(app.config['UPLOADS']) / filename)
        insert_data(name, email, cv, filename)
        print('File Uploaded')
        

@app.route('/')

def hello():
    return  render_template('home.html', jobs=all_data())




@app.route('/job/<id>')
def job(id):
    job = get_data(id)
    if not job:
        return 'Not Found', 404
    else:
        return render_template('job.html', job=get_data(id))

@app.route('/job/<id>/apply' , methods=['POST'])
def apply(id):
    name = request.form['name']
    email = request.form['email']
    cv = request.files['cv']
    handling_file(cv, name, email)
    job = get_data(id)
    job = job[0]['job title']
    return render_template('apply.html', job=job, name=name, email=email)


if __name__ == '__main__':
    app.run(debug=True)