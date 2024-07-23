import flask
from flask import request, jsonify, render_template 





app = flask.Flask(__name__)

@app.route('/')

def home():
    return render_template('home.html')


@app.route('/ai')
def ai():
    return render_template('ai.html')

@app.route('/bio')
def bio():
    return render_template('bio.html')

@app.route('/web')
def web():
    return render_template('web.html')

@app.route('/automation')
def automation():
    return render_template('automation.html')










if __name__ == '__main__':
    app.run(debug=True)