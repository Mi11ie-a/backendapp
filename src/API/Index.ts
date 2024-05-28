const express = require('express');
const app = express();
const cors = require('cors')
const jwte = require('jwt-encode');
const jwtd = require('jwt-decode');
const jwt = require('jsonwebtoken');
const SwaggerUI = require('swagger-ui-express');
const SwaggerDoc = require('../../swagger.json');
const fs = require('fs')
const https = require('https')


require('dotenv').config();
const secret = process.env.SECRET_KEY;
const port = process.env.APP_PORT;
const bcrypt = require('bcrypt');

const TokenType = 'Bearer';


const knex = require('knex')({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'volcanoes',
      dateStrings: true
    },
});

app.use(cors());
app.use(express.json());
app.use('/', SwaggerUI.serve);
app.get('/', SwaggerUI.setup(SwaggerDoc));

class AuthError extends Error {

    Status;
    
    constructor(message, status)
    {
        super(message);
        this.Status = status
    }
}

class DateError extends Error {

    Status;
    
    constructor(message, status)
    {
        super(message);
        this.Status = status
    }
}

async function DateValidation(date)
{
    // Validate the date format
    const DateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!DateRegex.test(date) || isNaN(Date.parse(date))) 
        { throw new DateError("Invalid input: dob must be a real date in format YYYY-MM-DD.", 400); }
    console.log("Passed 1")
    // Check if date is in past
    if (Date.parse(date) > Date.now()) {throw new DateError("Invalid input: dob must be a date in the past.", 400);}
    // Check if days is valid and months is valid

    const DaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    date = date.split("-");
    console.log(date)
    if (!(date[1] > 0 && date[1] <= 12)) {throw new DateError("Invalid input: dob must be a real date in format YYYY-MM-DD.", 400);}
    console.log("Passed 2")
    if (!(date[2] <= DaysInMonth[date[1]-1])) {throw new DateError("Invalid input: dob must be a real date in format YYYY-MM-DD.", 400)}
    console.log("Passed 3")
    if (date[1] == 2 && !((date[2] <= DaysInMonth[date[1]-1]) || (date[2] <= 29 && date[0] % 4 == 0))) {throw new DateError("Invalid input: dob must be a real date in format YYYY-MM-DD.", 400)}
    
    return true;
}

async function GetJWTAuth(JWT)
{
    return jwt.verify(JWT, process.env.SECRET_KEY, (err, decoded) => {
        if (err == undefined)
            {
                return decoded;
            } else { throw err };
    })
}

async function GetUserExists(Email)
{
    const d = await knex.select('Email').from('users').where("Email", Email).first()
    if (d != undefined)
    {
        return true;
    }
    else
    {
        return false;
    }
}

async function GetAuth(Header, Email)
{
    if (Header == undefined) { return false; } // If no authorisation was provided
    const [Type, Token] = GetToken(Header);

    if (Type != TokenType)
    {
        throw new AuthError("Authorization header is malformed", 401);
    }
    
    if (Token != undefined && Type != undefined)
    {
        const Decoded = await GetJWTAuth(Token).catch((e) => {
            if (e.name = "JsonWebTokenError" && e.message != "jwt malformed")
            {
                throw new AuthError("Invalid JWT token", 401);
            }
            if (e.name = "JsonWebTokenError" && e.message == "jwt malformed")
            {
                throw new AuthError("Invalid JWT token", 401);
            }
            if (e.name = "NotBeforeError")
            {
                throw new AuthError("JWT token has expired", 401);
            }
            //throw new AuthError(e.message, 401); // Fallback
        });
        const d = await knex.select('Email').from('users').where("Email", Decoded.data.Email).first();
        var Auth = false;


        if (d != undefined)
        {
            if (Email != Decoded.data.Email && Email != undefined)
            {
                throw new AuthError("Forbiden", 403)
            }
            Auth = true;
        }
        else
        {
            throw new AuthError("Authorization header is malformed", 401)
        }

        return Auth;
       
    } else { throw new AuthError("Authorization header is malformed", 401); }
}


function GetToken(str)
{
    const arr = str.split(/(\s+)/);
    return [arr[0], arr[2]]
}



app.get('/me', (req, res) => {

    const me = {
        name: "Amelia Kirn",
        student_number: "n11247002"
    }
    res.send(me);
  })

app.get('/countries', (req, res) => {
    
    const data = knex.select('country').from('data').orderBy("country", "asc").distinct("country").then((d)=>
        {
            var carr = [];
            for (var i of d)
            {
                carr.push(i.country);
            }
            res.send(carr)
        });
})

app.get('/volcano/:id', (req, res) => {

    const Header = req.headers.authorization;
    GetAuth(Header, undefined)
    .then((Auth) => {
        if (Object.keys(req.query).length !== 0) {res.status(400); res.send({error:true, message:"Invalid query parameters. Query parameters are not permitted."}); return;}
        if (Auth)
        {
            knex.select('*').from('data').where("id", req.params.id).first().then((d)=>
            {
                if (d == undefined) { res.status(404); res.send({error:true, message:"Volcano with ID: " + req.params.id + " not found."})}
                res.send(d);
                return;
            });
        }
        else
        {
            knex.select('id', 'name', 'country', 'region', 'subregion', 'last_eruption', 'summit', 'elevation', 'latitude', 'longitude')
            .from('data').where("id", req.params.id).first()
            .then((d)=>
            {
                if (d == undefined) { res.status(404); res.send({error:true, message:"Volcano with ID: " + req.params.id + " not found."})}
                res.send(d)
            });
        }
    })
    .catch((e) => {
        if (e instanceof AuthError)
        {
            res.status(e.Status);
            res.send({error:true, message:e.message});
        }
        return;
    });
})

app.get('/volcanoes', (req, res) => {
    
    for (var i of Object.keys(req.query))
    {
        if (i != "country" && i != "populatedWithin")
        {
            res.status(400); res.send({error:true, message:"Invalid query parameters. Only country and populatedWithin are permitted."}); return;
        }
        if (i != "populatedWithin" && i != "country")
        {
            res.status(400); res.send({error:true, message:"Invalid query parameters. Only country and populatedWithin are permitted."}); return;
        }
    }

    if (Object.keys(req.query).length == 0 || req.query.country == undefined) 
        {res.status(400); res.send({error:true, message:"Country is a required query parameter."}); return;}

    if (req.query.populatedWithin != undefined)
    {
        const Accepted = ["5km", "10km", "30km", "100km"]
        if (!Accepted.includes(req.query.populatedWithin))
        {
            res.status(400);
            res.send({error:true, message:"Invalid value for populatedWithin. Only: 5km,10km,30km,100km are permitted."});
            return;
        }
        // If optional query param is provided
        knex.select('id', 'name', 'country', 'region', 'subregion').from('data').where({country: req.query.country}).andWhere("population_"+req.query.populatedWithin, ">", 0)
        .then((d) =>{
            res.status(200);
            res.send(d);
            return;
        })
    } else
    {
        knex.select('id', 'name', 'country', 'region', 'subregion').from('data').where("country", req.query.country)
        .then((d)=>
        {
            if (d.length == 0 ) {res.status(200); res.send([]); return;}
        
            res.status(200);
            res.send(d)
        });
    }

    
})

app.post('/user/register', (req, res) => {

    const Request = req.body;

    // If Request body invalid or not present
    if (Request.email == undefined || Request.password == undefined) 
    {
        res.status(400);
        res.send({error:true, message:"Request body incomplete, both email and password are required"})
        return;
    }

    // Check if user already exists
    knex.select('Email').from('users').where('Email', Request.email).first()
    .then((d) => {

        if (d != undefined) 
        {
            res.status(409);
            res.send({error:true, message:"User already exists"})
            return;
        }

        // User doesnt already exist create new user
        bcrypt.hash(Request.password, 10, (err, hash) => {
            
            knex.insert({Email: Request.email, Password: hash}).into("users")
            .then((d)=>
            {
                res.status(201);
                res.send({message: "User created"})
            });

        })
    }); 
})

app.post('/user/login', (req, res) => {

    const Request = req.body;
    // If Request body invalid or not present
    if (Request == undefined || Request.email == undefined || Request.password == undefined) 
    {
        res.status(400);
        res.send({error:true, message:"Request body incomplete, both email and password are required"})
        return;
    }

    knex.select("Email", "Password").from("users").where('Email', Request.email).first()
    .then((d) => {
        
        // Check if user exists
        if (d == undefined) {res.status(401); res.send({error:true, message:"Incorrect email or password"}); return;}

        // Construct JWT
        const IssueTime = Date.now();


        const jwtdata = {
            Email: Request.email
        }

        const jwtt = jwt.sign({
            exp: Math.floor(Date.now() / 1000) + Number.parseInt(process.env.JWT_EXPIRY || '8400'),
            data:jwtdata
        }, process.env.SECRET_KEY);

        const Token = {
            token: jwtt,
            token_type: "Bearer",
            expires_in: Number.parseInt(process.env.JWT_EXPIRY || '8400')
        }

        // Compare Passwords
        bcrypt.compare(Request.password, d.Password, (err, result)=>{
            if (result == true)
            {
                res.status(200);
                res.send(Token);
                return;
            }
            res.status(401);
            res.send({error:true, message:"Incorrect email or password"})
        })
    })

    
})


app.get('/user/:email/profile', (req, res) => {
    const Header = req.headers.authorization;
    GetAuth(Header, req.params.email)
    .then((Auth) => {
        if (Auth)
        {
            knex.select("Email", "FirstName", "LastName", "DOB", "Address").from("users").where('Email', req.params.email).first()
            .then((d) => {
                if (d == undefined) {res.status(404); res.send({error:true, message:"User not found"}); return;}
                res.status(200);
                res.send({
                    email: d.Email,
                    firstName: d.FirstName,
                    lastName: d.LastName,
                    dob: d.DOB,
                    address: d.Address
                });
                return;
            })
        } else {

            knex.select("Email", "FirstName", "LastName").from("users").where('Email', req.params.email).first()
            .then((d) => {
                if (d == undefined) {res.status(404); res.send({error:true, message:"User not found"}); return;}
    
                res.status(200);
                res.send({
                    email: d.Email,
                    firstName: d.FirstName,
                    lastName: d.LastName
                });
                return;
            })
        }
    })
    .catch((e) => {
        if (e instanceof AuthError)
        {
            // If non matching email still show unauthenticated version
            if (e.Status == 403)
            {
                knex.select("Email", "FirstName", "LastName").from("users").where('Email', req.params.email).first()
                .then((d) => {
                if (d == undefined) {res.status(404); res.send({error:true, message:"User not found"}); return;}
    
                    res.status(200);
                    res.send({
                        email: d.Email,
                        firstName: d.FirstName,
                        lastName: d.LastName
                    });
                    return;
                })
            } else {
                res.status(e.Status);
                res.send({error:true, message:e.message});
            }
        }
        return;
    });
})

app.put('/user/:email/profile', (req, res) => {
    const Header = req.headers.authorization;

    if (Header == undefined) {res.status(401); res.send({error:true, message:"Authorization header ('Bearer token') not found"}); return;}

    GetUserExists(req.params.email).then((Exists) => {
        if (!Exists) { res.status(404); res.send({error:true, message:"Not found"}); return;}

        GetAuth(Header, req.params.email)
        .then(async(Auth) => {
        const NewData = req.body;
        
        // Check if body is present
        if (NewData == undefined) { res.status(400); res.send({error:true, message:"Request body incomplete: firstName, lastName, dob and address are required."}); return;}
        if (NewData.firstName == undefined || NewData.lastName == undefined || NewData.dob == undefined || NewData.address == undefined)
            { res.status(400); res.send({error:true, message:"Request body incomplete: firstName, lastName, dob and address are required."}); return;}

        // Check body data types
        if (!(typeof NewData.firstName == 'string' && typeof NewData.lastName == 'string' && typeof NewData.address == 'string')
        ) { res.status(400); res.send({error:true, message:"Request body invalid: firstName, lastName and address must be strings only."}); return; }
        
        try {
            await DateValidation(NewData.dob)
        } catch (e)
        {
            res.status(e.Status); res.send({error:true, message:e.message}); return;
        }
    
        if (Auth)
        {
            knex('users').where('Email', req.params.email).update({
                FirstName: NewData.firstName,
                LastName: NewData.lastName,
                DOB: NewData.dob,
                Address: NewData.address
            }).then((d) => {
                knex.select("Email", "FirstName", "LastName", "DOB", "Address").from("users").where('Email', req.params.email).first()
                .then((updated) => {
                    res.status(200);
                    res.send({
                        email: updated.Email,
                        firstName: updated.FirstName,
                        lastName: updated.LastName,
                        dob: updated.DOB,
                        address: updated.Address
                    });
                })
                
            })
        } else {
            res.status(401);
            res.send({error:true, message:"Unauthorised"})
        }
        })
        .catch((e) => {
            if (e instanceof AuthError)
            {
                res.status(e.Status);
                res.send({error:true, message:e.message});
            }
            return;
        });
    })
    
})

function ExtractEmail(Header)
{
    const [Type, Token] = GetToken(Header);
    const decoded = jwtd.jwtDecode(Token);
    return decoded.data.Email
}

async function DoesVolcanoExist(ID)
{
    const Resp = await knex.select('id').from('data').where('id', ID).first();
    if (Resp != undefined)
    {
        return true;
    }

    return false;
}

app.post('/volcano/:id/comment', (req, res) => {
    const Header = req.headers.authorization;
    const Email = ExtractEmail(Header)
    if (Header == undefined) {res.status(401); res.send({error:true, message:"Authorization header ('Bearer token') not found"}); return;}
    
    GetAuth(Header, Email)
        .then(async(Auth) => {
            if (Auth)
            {
                if (req.params.id == undefined)
                {
                    res.status(400);
                    res.send({error:true, message:"Malformed Request: id is a required parameter."})
                }
                const Exists = await DoesVolcanoExist(req.params.id);
                if (!Exists) 
                {
                    res.status(400);
                    res.send({error:true, message:"Volcano with ID: " + req.params.id + " not found."})
                }
                const NewComment = req.body;
                const TS = new Date()
                console.log(NewComment)
                // Check if body contains required params
                if (NewComment.CommentTitle == undefined || NewComment.CommentBody == undefined)
                {
                    res.status(400);
                    res.send({error:true, message:"Malformed Request Body: CommentTitle and Comment body are required parameters"})
                    return;
                }
                
                // Check param type
                if (typeof NewComment.CommentTitle != 'string' || typeof NewComment.CommentBody != 'string')
                {
                    res.status(400);
                    res.send({error:true, message:"Malformed Request Body: CommentTitle and Comment body must be strings"})
                }

                knex.select("UserID").from("users").where("Email", Email).first()
                .then((d) => {
                    knex.insert({CommentTitle: NewComment.CommentTitle, CommentBody: NewComment.CommentBody, CommentTime:TS, UserID: d.UserID, VolcanoID:req.params.id}).into("comments")
                    .then((s) => {
                        res.status(200);
                        res.send({error:false, message:"Comment added"})
                    }).catch((e) => {
                        // In case there is a DB error
                        res.status(500);
                        res.send({error:true, message:"Server Error"})
                    })
                }).catch((e) => {
                    // Ideally this never happens
                    res.status(404);
                    res.send({error:true, message:"JWT Invalid: Not a user!"})
                });
            }
        })
    .catch((e) => {
        if (e instanceof AuthError)
        {
            res.status(e.Status);
            res.send({error:true, message:e.message});
        }
        return;
    });
})

app.get('/volcano/:id/comment', async(req,res) => {
    
    if (req.params.id == undefined)
    {
        res.status(400);
        res.send({error:true, message:"Malformed Request: id is a required parameter"})
    }
    const Exists = await DoesVolcanoExist(req.params.id);
    if (!Exists) 
    {
        res.status(400);
        res.send({error:true, message:"Volcano with ID: " + req.params.id + " not found."})
    }
    knex('comments').join('users', 'comments.UserID', 'users.UserID').select("Email", "CommentTitle", "CommentBody", "CommentTime").where("VolcanoID", req.params.id)
    .then((d) => {
        res.status(200);
        res.send(d);
    })

})

var Server = https.createServer({
    key: fs.readFileSync('cert/server.key', 'utf8'),
    cert: fs.readFileSync('cert/server.crt', 'utf8')
}, app);

Server.listen(port, () => {
    console.log(`VolcanoAPI Application listening on port ${port}`)
})