from sqlalchemy import create_engine,text
import pymysql
import pandas as pd



engine = create_engine('mysql+pymysql://root:1001@localhost:3306/agbadatabase?charset=utf8')




def all_data():
    with engine.connect() as conn:
        a = conn.execute(text("select * from data"))
        all = [x._asdict() for x in a]
        return all


def get_data(id):
    with engine.connect() as conn:
        a = conn.execute(text("select * from data where id = :id"),{'id':id})
        all = [x._asdict() for x in a]
        return all
    

def insert_data(name, email, cv, filename):
    try:
        
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO uploaded_files (name, email, filename, data) VALUES (:name, :email, :filename, :data)"), {'name':name, 'email':email, 'filename':filename, 'data':cv})
    except Exception as e:
        print(e)
        return False
  
    
     




