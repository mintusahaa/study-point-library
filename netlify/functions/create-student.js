const { createClient } =
  require("@supabase/supabase-js");


exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {

    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };

  }


  try {

    const authorization =
      event.headers.authorization || "";


    if (!authorization.startsWith("Bearer ")) {

      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Admin login required"
        })
      };

    }


    const accessToken =
      authorization.substring(7);


    const supabaseAdmin =
      createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );


    /* Verify logged-in user */

    const {
      data: {
        user
      },
      error: userError
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );


    if (userError || !user) {

      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Invalid login session"
        })
      };

    }


    /* Verify ADMIN */

    const {
      data: adminProfile,
      error: adminError
    } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();


    if (
      adminError ||
      !adminProfile ||
      adminProfile.role !== "admin"
    ) {

      return {
        statusCode: 403,
        body: JSON.stringify({
          error: "Admin access required"
        })
      };

    }


    /* Get form data */

    const body =
      JSON.parse(event.body || "{}");


    const studentId =
      String(
        body.student_id || ""
      ).replace(/\D/g, "");


    const fullName =
      String(
        body.full_name || ""
      ).trim();


    const phone =
      String(
        body.phone || studentId
      ).replace(/\D/g, "");


    const password =
      String(
        body.password || "12345678"
      );


    if (
      !studentId ||
      !fullName ||
      password.length < 8
    ) {

      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Name, phone/student ID and password are required."
        })
      };

    }


    /* Check duplicate student */

    const {
      data: existing
    } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("student_id", studentId)
        .maybeSingle();


    if (existing) {

      return {
        statusCode: 409,
        body: JSON.stringify({
          error:
            "This Student ID already exists."
        })
      };

    }


    /* Internal email */

    const internalEmail =
      `${studentId}@students.studypointlibrary.local`;


    /* Create Supabase Auth account */

    const {
      data: created,
      error: createError
    } =
      await supabaseAdmin.auth.admin.createUser({

        email: internalEmail,

        password: password,

        email_confirm: true,

        user_metadata: {
          full_name: fullName,
          student_id: studentId,
          phone: phone
        }

      });


    if (createError) {

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: createError.message
        })
      };

    }


    /* Create student profile */

    const {
      error: profileError
    } =
      await supabaseAdmin
        .from("profiles")
        .upsert({

          id: created.user.id,

          student_id: studentId,

          full_name: fullName,

          phone: phone,

          role: "student"

        });


    if (profileError) {

      await supabaseAdmin.auth.admin.deleteUser(
        created.user.id
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          error: profileError.message
        })
      };

    }


    return {

      statusCode: 200,

      body: JSON.stringify({

        success: true,

        student: {

          id: created.user.id,

          student_id: studentId,

          full_name: fullName,

          phone: phone

        }

      })

    };


  } catch (error) {

    return {

      statusCode: 500,

      body: JSON.stringify({

        error:
          error.message ||
          "Server error"

      })

    };

  }

};
