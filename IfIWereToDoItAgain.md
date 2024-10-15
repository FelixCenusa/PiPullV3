If I were to do this project again I would do this as well:

Implement automated tests because it was too often that i fixed one thing for another to break, but i didnt notice it until waaay later.
Ask the client directly all the extra features they might like so i dont have to sit and edit the backend a lot.
Security:
    Only send data to frontend that is needed for the frontend to work.
    Dont send the userID or anything that can be used to identify the user.
    Dont trust anything that comes from the frontend.
    Validate user first, then trust them and send the least amount of data to the frontend.

Will Let Node MODULES UPLOAD
